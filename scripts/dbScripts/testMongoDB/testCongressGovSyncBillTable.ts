// import * as mongoDbLib from '../../../libs/mongodbLib';
// import { MongoDbConfig } from '../../../config/mongodb';
import { CongressGovDataProvider } from '../../../libs/congressGov/CongressGovDataProvider';

// const tblName = MongoDbConfig.tableNames.CONGRESSGOV_SYNC_BILL_TABLE_NAME;

class TestCongressGovSyncBillTable {
  public static async putObject () {
    let c = new CongressGovDataProvider();
    let $ = await c.fetchBillTextHtml('https://www.congress.gov/bill/115th-congress/house-bill/4288/text');
    console.log('HTML length = ' + $.html().length);
  }

  // private static async getTable () {
  //   const db = await mongoDbLib.MongoDBManager.instance;
  //   const tblCat = db.getTable<mongoDbLib.CongressGovSyncBillTable>(tblName);
  //   return tblCat;
  // }
}

TestCongressGovSyncBillTable.putObject();
