import * as _ from 'lodash';
import { MongoClient } from 'mongodb';
import { DataGraphUtils } from '../DataGraph';

const config = {
  'dbUrl': 'mongodb://localhost:27017',
  'dbName': 'congress',
  'billTable': 'volunteer.bills',
  'roleTable': 'volunteer.roles',
};

async function getAllDocs (collection, limit?): Promise<object[]> {
  let find = collection.find({})
  if (limit) {
    find = find.limit(limit);
  }
  return find.toArray();
}

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

(async function main () {
  let dbClient = await MongoClient.connect(
    config.dbUrl,
    { useNewUrlParser: true },
  );
  let db = dbClient.db(config.dbName);

  // print field coverage
  let billTable = db.collection(config.billTable);
  let rawBills = await getAllDocs(billTable);

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
  // ? detailTitles: '894 (80.83%)',
  // A sponsorRoleId: '894 (80.83%)',
  // ? s3Entity: '894 (80.83%)',
  // ? subjects: '888 (80.29%)',
  // ? versions: '894 (80.83%)',
  // ? actionsAll: '894 (80.83%)',
  // ? actions: '894 (80.83%)',
  // ? committees: '869 (78.57%)',
  // ? relatedBills: '476 (43.04%)',
  // + tags: '308 (27.85%)',
  // - comment: '72 (6.51%)',
  // - id: '186 (16.82%)',
  // ? relevence: '61 (5.52%)',
  // - lastUpdated: '46 (4.16%)',
  // - currentChamber: '46 (4.16%)',
  // - contributors: '66 (5.97%)',
  // - status: '66 (5.97%)',
  // + relevance: '48 (4.34%)',
  // - summary: '48 (4.34%)',
  // - summary_zh: '23 (2.08%)',
  // - insight: '18 (1.63%)',
  // - china: '37 (3.35%)',
  // - articles: '1 (0.09%)' }

  let billEntData = _.map(rawBills, b => {
    let bill = {
      _id: b['_id'],
      congress: b['congress'],
      billType: b['billType']['code'],
      billNumber: b['billNumber'],
      title: b['title'],
      title_zh: b['title_zh'],
      // introducedDate: DataGraphUtils.tsToDate(b['introducedDate']),
      trackers: b['trackers'],

    };
  });



  dbClient.close();
})();