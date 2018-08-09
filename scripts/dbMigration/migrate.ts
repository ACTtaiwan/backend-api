import * as _ from 'lodash';
import { MongoDbConfig } from '../../config/mongodb';
import * as mongoDbLib from '../../libs/mongodbLib';

async function migrateTable (
  table: mongoDbLib.MongoDBTable,
) {
  if (table instanceof mongoDbLib.BillTable) {
    // let results = await table.getBillsByMongoQuery({}, ['id']);
    // _.each(results, (v) => {
    //   console.log(v);
    // });
    console.log(mongoDbLib.BillTable.name);
  } else if (table instanceof mongoDbLib.BillCategoryTable) {
    console.log(mongoDbLib.BillCategoryTable.name);
  }
}

/**
 * Migrate database format from dbLib to dbLib2
 */
async function migrate (): Promise<void> {
  const db = await mongoDbLib .MongoDBManager.instance;
  await Promise.all(_.map(MongoDbConfig.tableNames, tableName =>
    migrateTable(db.getTable(tableName))));
  // await migrateTable(db.getTable(MongoDbConfig.tableNames.BILLS_TABLE_NAME));
  // const tblBillName = MongoDbConfig.tableNames.BILLS_TABLE_NAME;
  // let tbl: mongoDbLib.BillTable = db.getTable(tblBillName);
}

migrate();