import * as _ from 'lodash';
import { connectMongo, readAllDocs } from './utils';
import * as moment from 'moment';
import { MongoDbConfig } from '../../config/mongodb';
import { DataGraph, Type } from '../../libs/dbLib2/DataGraph';
import { Logger } from '../../libs/dbLib2/Logger';
import { MongoClient } from 'mongodb';
import { CongressUtils } from '../../libs/dbLib2/CongressUtils';
import { DataManager } from '../../libs/dbLib2/DataManager';
import Utility from '../../libs/utils/Utility';

const config = {
  'dbName': 'congress',
  'billTable': 'volunteer.bills',
  'roleTable': 'volunteer.roles',
  'personTable': 'volunteer.persons',
  'articleSnippetTable': 'site.articleSnippets',
};

let logger = new Logger('migrate.ts');

function fieldCoverage (items: object[]): object {
  let coverage = _.reduce(
    items,
    (coverage, item) => _.mergeWith(coverage, item, (cover, v) => {
      if (!v) {
        return cover;
      }
      if (!cover) {
        return 1;
      }
      return cover + 1;
    }),
    {},
  );
  let total = items.length;
  coverage = _.mapValues(coverage, (v: number) =>
    `${v} (${(v / total * 100).toFixed(2)}%)`);
  return coverage;
}

/**
 * @param date could be 12am anywhere in the west hemisphere on the intended
 *  day; e.g., 12am at EST or GMT
 * @returns timestamp at 12am EST (-0500) on the same day
 */
function calibrateDate (date: number): number {
  if (!date) {
    return;
  }
  let str = moment.utc(date).format('YYYY-MM-DD');
  let utcHour = moment.utc(date).hour();
  let estDateStr = moment.utc(date).utcOffset(-5).format('YYYY-MM-DD');
  if (utcHour > 0 && str !== estDateStr) {
    throw Error(`Timestamp ${date} converts to ${str}(utc) `
      + `!= ${estDateStr}(est)`);
  }
  // Return a new timestamp at 12am EST on the same day
  const epoch = Utility.parseDateTimeStringAtEST(str, 'YYYY-MM-DD').getTime();
  return epoch;
}

async function migrateTags (m: DataManager, source: MongoClient) {
  let rawSourceBills = await readAllDocs(
    source,
    config.dbName,
    config.billTable,
  );

  let sourceTags = {};
  _.each(rawSourceBills, b => {
    _.each(b['tags'], t => {
      let name = t['tag'];
      if (!(name in sourceTags)) {
        sourceTags[name] = {
          _id: undefined,
          _type: Type.Tag,
          name: name,
        };
      }
    });
  });

  await m.importDataset(Type.Tag, _.values(sourceTags), [ 'name' ], true, true);
}

async function migrateBills (m: DataManager, source: MongoClient) {
  let rawSourceBills = await readAllDocs(
    source,
    config.dbName,
    config.billTable,
  );

  // console.log(fieldCoverage(rawBills));
  // + _id: '1106 (100.00%)',
  // + congress: '1106 (100.00%)',
  // + billType: '1106 (100.00%)',
  // + billNumber: '1106 (100.00%)',
  // + title: '1106 (100.00%)',
  // + title_zh: '811 (73.33%)',
  // - categories: '1101 (99.55%)',
  // + introducedDate: '894 (80.83%)',
  // A cosponsors: '894 (80.83%)',
  // + trackers: '894 (80.83%)',
  // - detailTitles: '894 (80.83%)',
  // A sponsorRoleId: '894 (80.83%)',
  // + s3Entity: '894 (80.83%)',
  // - subjects: '888 (80.29%)',
  // + versions: '894 (80.83%)',
  // + actionsAll: '894 (80.83%)',
  // + actions: '894 (80.83%)',
  // - committees: '869 (78.57%)',
  // - relatedBills: '476 (43.04%)',
  // + tags: '308 (27.85%)',
  // - comment: '72 (6.51%)',
  // - id: '186 (16.82%)',
  // - relevence: '61 (5.52%)',
  // - lastUpdated: '46 (4.16%)',
  // - currentChamber: '46 (4.16%)',
  // - contributors: '66 (5.97%)',
  // - status: '66 (5.97%)',
  // - relevance: '48 (4.34%)',
  // + summary: '48 (4.34%)',
  // + summary_zh: '23 (2.08%)',
  // - insight: '18 (1.63%)',
  // - china: '37 (3.35%)',
  // - articles: '1 (0.09%)',

  let sourceBills = _.map(rawSourceBills, b => {
    return {
      _id: b['_id'],
      _type: Type.Bill,
      congress: b['congress'],
      billType: b['billType']['code'],
      billNumber: b['billNumber'],
      title: b['title'],
      title_zh: b['title_zh'],
      introducedDate: calibrateDate(b['introducedDate']),
      trackers: b['trackers'],
      s3Entity: b['s3Entity'],
      versions: b['versions'],
      actions: b['actions'],
      actionsAll: b['actionsAll'],
      summary: b['summary'],
      summary_zh: b['summary_zh'],
    };
  });

  await m.importDataset(Type.Bill, sourceBills, [ '_id' ], true, true);
}

async function migratePersons (m: DataManager, source: MongoClient) {
  let rawSourcePersons = await readAllDocs(
    source,
    config.dbName,
    config.personTable,
  );
  // logger.log(fieldCoverage(rawSourcePersons));
  // + _id: '12441 (100.00%)',
  // + firstname: '12441 (100.00%)',
  // + middlename: '8549 (68.72%)',
  // + lastname: '12441 (100.00%)',
  // + nameMod: '440 (3.54%)',
  // + profilePictures: '12435 (99.95%)',
  // + govTrackId: '12437 (99.97%)',
  // - createdAt: '12441 (100.00%)',
  // - committeeAssignments: '12440 (99.99%)',
  // - lastUpdatedAt: '12441 (100.00%)',
  // + searchName: '12441 (100.00%)',
  // + bioGuideId: '12425 (99.87%)',
  // + gender: '12440 (99.99%)',
  // + birthday: '11886 (95.54%)',
  // + osId: '1102 (8.86%)',
  // + pvsId: '970 (7.80%)',
  // + cspanId: '851 (6.84%)',
  // + nickname: '257 (2.07%)',
  // + twitterId: '1 (0.01%)',
  let sourcePersons = _.map(rawSourcePersons, p => {
    return {
      _id: p['_id'],
      _type: Type.Person,
      firstName: p['firstname'],
      middleName: p['middlename'],
      lastName: p['lastname'],
      nameSuffix: p['nameMod'],
      nickname: p['nickname'],
      profilePictures: p['profilePictures'],
      gender: p['gender'],
      birthday: p['birthday'],
      govTrackId: p['govTrackId'],
      bioGuideId: p['bioGuideId'],
      osId: p['osId'],
      pvsId: p['pvsId'],
      cspanId: p['cspanId'],
      twitterId: p['twitterId'],
    };
  });
  let sourcePersonsById = _.keyBy(sourcePersons, p => p._id);

  let rawSourceRoles = await readAllDocs(
    source,
    config.dbName,
    config.roleTable,
  );
  // logger.log(fieldCoverage(rawSourceRoles));
  // E _id: '41706 (100.00%)',
  // + congressNumbers: '41706 (100.00%)',
  // + roleType: '41706 (100.00%)', --> redefine: chamber
  // - roleTypeDisplay: '41706 (100.00%)',
  // + startDate: '41705 (100.00%)',
  // + endDate: '41706 (100.00%)',
  // - createdAt: '41706 (100.00%)',
  // + party: '41312 (99.06%)',
  // - title: '41706 (100.00%)',
  // - titleLong: '41706 (100.00%)',
  // - lastUpdatedAt: '41706 (100.00%)',
  // + state: '41706 (100.00%)',
  // + district: '37308 (89.45%)',
  // - description: '41706 (100.00%)',
  // E personId: '41706 (100.00%)',
  // * website: '3895 (9.34%)',
  // - senatorClassDisplay: '3615 (8.67%)',
  // + senatorClass: '3615 (8.67%)', --> retype: number
  // A billIdCosponsored: '5606 (13.44%)',
  // A billIdSponsored: '557 (1.34%)',
  // * office: '1997 (4.79%)',
  // * phone: '1999 (4.79%)',
  // - leadershipTitle: '36 (0.09%)',
  // - senatorRankDisplay: '176 (0.42%)',
  // - senatorRank: '176 (0.42%)',
  // - caucus: '3 (0.01%)',
  _.each(rawSourceRoles, r => {
    let state = CongressUtils.validateState(r['state']);
    if (!state) {
      throw Error(`Invalid state: ${state}`);
    }
    let role = _.pickBy({
      congressNumbers: r['congressNumbers'],
      chamber: r['roleType'] === 'senator' ? 's' : 'h',
      startDate: calibrateDate(r['startDate']),
      endDate: calibrateDate(r['endDate']),
      party: r['party'],
      state: state,
      district: r['district'],
      senatorClass: r['senatorClass'] ?
        _.parseInt(_.replace(r['senatorClass'], 'class', '')) :
        r['senatorClass'],
      // to be merged at the person level below
      website: r['website'],
      office: r['office'],
      phone: r['phone'],
    });
    // insert this role to the corresponding person
    let p = sourcePersonsById[r['personId']];
    if (p === undefined) {
      throw Error(`Person ID ${r['personId']} not found for role ${r['_id']}`);
    }
    if (p['congressRoles'] === undefined ||
        !Array.isArray(p['congressRoles'])) {
      p['congressRoles'] = [];
    }
    p['congressRoles'].push(role);
  });

  // sort each person's congress roles in reverse chrono order
  _.each(sourcePersons, p => {
    p['congressRoles'] = _.sortBy(p['congressRoles'], r => -r['endDate']);
  });

  // set person's latest contact info
  _.each(sourcePersons, p => {
    let website, office, phone;
    _.each(p['congressRoles'], r => {
      if (!website && r['website']) {
        website = r['website'];
      }
      delete r['website'];
      if (!office && r['office']) {
        office = r['office'];
      }
      delete r['office'];
      if (!phone && r['phone']) {
        phone = r['phone'];
      }
      delete r['phone'];
    });
    if (website) {
      p['website'] = website;
    }
    if (office) {
      p['office'] = office;
    }
    if (phone) {
      p['phone'] = phone;
    }
  });

  await m.importDataset(Type.Person, sourcePersons, [ '_id' ], true, true);
}

async function migrateArticleSnippets (m: DataManager, source: MongoClient) {
  let rawSourceArticleSnippets = await readAllDocs(
    source,
    config.dbName,
    config.articleSnippetTable,
  );

  // console.log(fieldCoverage(rawSourceArticleSnippets));
  // + _id: '20 (100.00%)',
  // + readableId: '20 (100.00%)',
  // + headline: '19 (95.00%)',
  // + subhead: '17 (85.00%)',
  // + author: '16 (80.00%)',
  // + intro: '20 (100.00%)',
  // + url: '20 (100.00%)',
  // + imageUrl: '20 (100.00%)',
  // + date: '20 (100.00%)',
  // - id: '16 (80.00%)',
  // + sites: '20 (100.00%)',

  let sourceArticleSnippets = _.map(rawSourceArticleSnippets, a => {
    return {
      _id: a['_id'],
      _type: Type.ArticleSnippet,
      readableId: a['readableId'],
      headline: a['headline'],
      subhead: a['subhead'],
      author: a['author'],
      intro: a['intro'],
      url: a['url'],
      imageUrl: a['imageUrl'],
      date: a['date'],
      sites: a['sites'],
    };
  });

  await m.importDataset(
    Type.ArticleSnippet,
    sourceArticleSnippets,
    [ '_id' ],
    true,
    true,
  );
}


async function migrateSponsor (m: DataManager, source: MongoClient) {
  let rawSourceBills = await readAllDocs(
    source,
    config.dbName,
    config.billTable,
  );
  let billIdSet = new Set(_.map(
    await m.loadAll(Type.Bill),
    b => b._id,
  ));

  let rawSourceRoles = await readAllDocs(
    source,
    config.dbName,
    config.roleTable,
  );
  let rawSourceRolesById = _.keyBy(rawSourceRoles, r => r['_id']);

  let personIdSet = new Set(_.map(
    await m.loadAll(Type.Person),
    p => p._id,
  ));

  let sourceSponsorAssocs = [];
  _.each(rawSourceBills, b => {
    let rId = b['sponsorRoleId'];
    if (!rId) {
      return;
    }
    let r = rawSourceRolesById[rId];
    if (!r) {
      throw Error(`Cannot find sponsor role for bill ${b}`);
    }
    let pId = r['personId'];
    if (!pId) {
      throw Error(`Cannot find person ID for role ${r}`);
    }
    if (!billIdSet.has(b['_id'])) {
      throw Error(`Bill ID ${b['_id']} does not exist in data graph`);
    }
    if (!personIdSet.has(pId)) {
      throw Error(`Person ID ${pId} does not exist in data graph`);
    }
    sourceSponsorAssocs.push({
      _type: Type.Sponsor,
      _id1: pId,
      _id2: b['_id'],
    });
  });

  await m.importDataset(
    Type.Sponsor,
    sourceSponsorAssocs,
    [ '_id1', '_id2' ],
    true,
    true,
  );
}

async function migrateCosponsor (m: DataManager, source: MongoClient) {
  let rawSourceBills = await readAllDocs(
    source,
    config.dbName,
    config.billTable,
  );
  let billIdSet = new Set(_.map(
    await m.loadAll(Type.Bill),
    b => b._id,
  ));

  let rawSourceRoles = await readAllDocs(
    source,
    config.dbName,
    config.roleTable,
  );
  let rawSourceRolesById = _.keyBy(rawSourceRoles, r => r['_id']);

  let personIdSet = new Set(_.map(
    await m.loadAll(Type.Person),
    p => p._id,
  ));

  let sourceCosponsorAssocs = [];
  _.each(rawSourceBills, b => {
    _.each(b['cosponsors'], cosp => {
      let rId = cosp['roleId'];
      if (!rId) {
        // deal with a strange data format
        rId = cosp['role']['id'];
        if (!rId) {
          logger.log(cosp);
          logger.log(cosp['id']);
          throw Error(`Cosponsor object does not contain 'roleId' or 'id': `
            + `${cosp}`);
        }
      }
      let r = rawSourceRolesById[rId];
      if (!r) {
        throw Error(`Cannot find cosponsor role for bill ${b}`);
      }
      let pId = r['personId'];
      if (!pId) {
        throw Error(`Cannot find person ID for role ${r}`);
      }
      if (!billIdSet.has(b['_id'])) {
        throw Error(`Bill ID ${b['_id']} does not exist in data graph`);
      }
      if (!personIdSet.has(pId)) {
        throw Error(`Person ID ${pId} does not exist in data graph`);
      }
      sourceCosponsorAssocs.push({
        _type: Type.Cosponsor,
        _id1: pId,
        _id2: b['_id'],
        date: cosp['dateCosponsored'],
      });
    });
  });

  await m.importDataset(
    Type.Cosponsor,
    sourceCosponsorAssocs,
    [ '_id1', '_id2' ],
    true,
    true,
  );
}

async function migrateHasTag (m: DataManager, source: MongoClient) {
  let rawSourceBills = await readAllDocs(
    source,
    config.dbName,
    config.billTable,
  );
  let billIdSet = new Set(_.map(
    await m.loadAll(Type.Bill),
    b => b._id,
  ));

  let tags = await m.loadAll(Type.Tag);
  let tagsByName = {};
  _.each(tags, t => {
    if (!t['name']) {
      throw Error(`Tag name undefined ${t}`);
    }
    if (t['name'] in tagsByName) {
      throw Error(`Duplicate tag name detected ${t}`);
    }
    tagsByName[t['name']] = t;
  });

  let hasTagAssocs = [];
  _.each(rawSourceBills, b => {
    _.each(b['tags'], t => {
      let tag = tagsByName[t['tag']];
      if (!tag) {
        throw Error(`Tag ${t['tag']} not found in data graph`);
      }
      if (!billIdSet.has(b['_id'])) {
        throw Error(`Bill ID ${b['_id']} does not exist in data graph`);
      }
      hasTagAssocs.push({
        _type: Type.HasTag,
        _id1: b['_id'],
        _id2: tag['_id'],
      });
    });
  });

  await m.importDataset(
    Type.HasTag,
    hasTagAssocs,
    [ '_id1', '_id2' ],
    true,
    true,
  );
}

async function main () {
  let sourceClient = await connectMongo(await MongoDbConfig.getUrl());
  let g = await DataGraph.get('MongoGraph', MongoDbConfig.getDbName());
  let m = new DataManager(g);

  await migrateTags(m, sourceClient);
  await migrateBills(m, sourceClient);
  await migratePersons(m, sourceClient);
  await migrateArticleSnippets(m, sourceClient);

  await migrateSponsor(m, sourceClient);
  await migrateCosponsor(m, sourceClient);
  await migrateHasTag(m, sourceClient);

  DataGraph.cleanup();
  sourceClient.close();

  logger.log('Done');
}

main();