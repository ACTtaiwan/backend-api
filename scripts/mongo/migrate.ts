import * as _ from 'lodash';
import { connectMongo, readAllDocs, getEntSetDiff } from './utils';
import * as moment from 'moment';
import { MongoDbConfig } from '../../config/mongodb';
import { DataGraph, Type, IEnt } from '../../libs/dbLib2/DataGraph';
import { Logger } from '../../libs/dbLib2/Logger';

const config = {
  'dbName': 'congress',
  'billTable': 'volunteer.bills',
  'roleTable': 'volunteer.roles',
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
  // When 12am hits anywhere in the west hemisphere, utc time is between
  // 12am and 12pm on the same day. We take the date part and 'export' it
  // as a string, while discarding the time part.
  let str = moment.utc(date).format('YYYY-MM-DD');
  // (sanity) throw if detect a change of date, assuming EST timezone
  let estDateStr = moment.utc(date).utcOffset(-5).format('YYYY-MM-DD');
  if (str !== estDateStr) {
    throw Error(`Timestamp ${date} converts to ${str}(utc) `
      + `!= ${estDateStr}(local)`);
  }
  // Return a new timestamp at 12pm utc on the same day
  return moment.utc(str + 'T12', 'YYYY-MM-DDTHH').toDate().getTime();
}

async function main () {
  let sourceClient = await connectMongo(await MongoDbConfig.getUrl());
  let g = await DataGraph.create('MongoGraph', MongoDbConfig.getDbName());

  let rawSourceBills = await readAllDocs(
    sourceClient,
    config.dbName,
    config.billTable,
  );

  // console.log(fieldCoverage(rawBills));
  // { _id: '1106 (100.00%)',
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
  // - articles: '1 (0.09%)' }

  let srcBills = _.map(rawSourceBills, b => {
    let data = _.pickBy({
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
    }, v => v !== undefined);
    let bill: IEnt = _.merge(data, { _id: b['_id'], _type: Type.Bill });
    return bill;
  });

  let currBills = await g.findEntities({ _type: Type.Bill });
  let diff = getEntSetDiff(currBills, srcBills);
  logger.log(`ent set diff:`);
  logger.log(diff);
  if (diff.insert.length > 0) {
    await g.insertEntities(diff.insert);
  }
  if (diff.update.length > 0) {
    await g.updateEntities(diff.update);
  }
  if (diff.delete.length > 0) {
    await g.deleteEntities(diff.delete);
  }



  sourceClient.close();
  g.close();
}

main();