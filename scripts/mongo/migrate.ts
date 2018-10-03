import * as _ from 'lodash';
import { connectMongo, readAllDocs, getDocSetDiff, cliConfirm } from './utils';
import * as moment from 'moment';
import { MongoDbConfig } from '../../config/mongodb';
import { DataGraph, Type, IEnt, IDataGraph } from '../../libs/dbLib2/DataGraph';
import { Logger } from '../../libs/dbLib2/Logger';
import { MongoClient } from 'mongodb';
import { CongressUtils } from '../../libs/dbLib2/CongressUtils';

const config = {
  'dbName': 'congress',
  'billTable': 'volunteer.bills',
  'roleTable': 'volunteer.roles',
  'personTable': 'volunteer.persons',
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
 *  day; e.g., 12am at eastern time (-0500)
 * @returns timestamp at 12pm UTC on the same day
 */
function calibrateDate (date: number): number {
  if (!date) {
    return;
  }
  // When 12am hits anywhere in the west hemisphere, utc time is between
  // 12am and 12pm on the same day. We take the date part and 'export' it
  // as a string, while discarding the time part.
  let str = moment.utc(date).format('YYYY-MM-DD');
  // (sanity) throw if detect a change of date, assuming EST timezone
  let utcHour = moment.utc(date).hour();
  let estDateStr = moment.utc(date).utcOffset(-5).format('YYYY-MM-DD');
  if (utcHour > 0 && str !== estDateStr) {
    throw Error(`Timestamp ${date} converts to ${str}(utc) `
      + `!= ${estDateStr}(est)`);
  }
  // Return a new timestamp at 12pm utc on the same day
  return moment.utc(str + 'T12', 'YYYY-MM-DDTHH').toDate().getTime();
}

async function migrateBills (g: IDataGraph, source: MongoClient) {
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
      tags: b['tags'],
      summary: b['summary'],
      summary_zh: b['summary_zh'],
    };
  });

  let targetBills = await g.findEntities({ _type: Type.Bill });
  let diff = getDocSetDiff('ent', targetBills, sourceBills);

  logger.log(`Bill migration plan:`);
  logger.log(diff);
  let proceed = await cliConfirm();
  if (!proceed) {
    logger.log('Abort');
    return;
  }

  if (diff.insert.length > 0) {
    await g.insertEntities(diff.insert);
  }
  if (diff.update.length > 0) {
    await g.updateEntities(diff.update);
  }
  if (diff.delete.length > 0) {
    await g.deleteEntities(diff.delete);
  }
}

async function migrateCongressMembers (g: IDataGraph, source: MongoClient) {
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
      profilePictures: p['prifilePictures'],
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

  // logger.log(sourcePersons);
  // logger.log(sourcePersonsById['e7a99b86-eee5-403a-9ef8-eaf78c1399c2']);

  let targetPersons = await g.findEntities({ _type: Type.Person });
  let diff = getDocSetDiff('ent', targetPersons, sourcePersons);

  logger.log(`Persons migration plan:`);
  logger.log(diff);
  let proceed = await cliConfirm();
  if (!proceed) {
    logger.log('Abort');
    return;
  }

  if (diff.insert.length > 0) {
    await g.insertEntities(diff.insert);
  }
  if (diff.update.length > 0) {
    await g.updateEntities(diff.update);
  }
  if (diff.delete.length > 0) {
    await g.deleteEntities(diff.delete);
  }
}

async function migrateSponsorship (g: IDataGraph, source: MongoClient) {
  let rawSourceBills = await readAllDocs(
    source,
    config.dbName,
    config.billTable,
  );
  let billIdSet = new Set(_.map(
    await g.findEntities({ _type: Type.Bill }),
    b => b._id,
  ));

  let rawSourceRoles = await readAllDocs(
    source,
    config.dbName,
    config.roleTable,
  );
  let rawSourceRolesById = _.keyBy(rawSourceRoles, r => r['_id']);

  let personIdSet = new Set(_.map(
    await g.findEntities({ _type: Type.Person }),
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

  let targetSponsorAssocs = await g.findAssocs({ _type: Type.Sponsor });
  let diff = getDocSetDiff('assoc', targetSponsorAssocs, sourceSponsorAssocs);

  logger.log(`Persons migration plan:`);
  logger.log(diff);
  let proceed = await cliConfirm();
  if (!proceed) {
    logger.log('Abort');
    return;
  }

  if (diff.insert.length > 0) {
    await g.insertAssocs(diff.insert);
  }
  if (diff.update.length > 0) {
    await g.updateAssocs(diff.update);
  }
  if (diff.delete.length > 0) {
    await g.deleteAssocs(diff.delete);
  }
}

async function main () {
  let sourceClient = await connectMongo(await MongoDbConfig.getUrl());
  let g = await DataGraph.create('MongoGraph', MongoDbConfig.getDbName());

  await migrateBills(g, sourceClient);
  await migrateCongressMembers(g, sourceClient);
  await migrateSponsorship(g, sourceClient);


  sourceClient.close();
  g.close();
}

main();