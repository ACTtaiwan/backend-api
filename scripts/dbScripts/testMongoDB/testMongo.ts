import * as mongoDbLib from '../../../libs/mongodbLib'
import { MongoDbConfig } from '../../../config/mongodb'

async function getTable () {
 const db = await mongoDbLib.MongoDBManager.instance;
 const tblCat = db.getTable<mongoDbLib.BillTable>(MongoDbConfig.tableNames.BILLS_TABLE_NAME);
 return tblCat;
}

async function main () {
 // console.log(checksum('asdf'));
 let table = await getTable();
 let bill = await table.getBill(104, 'hconres', 33, 'title', 'title_zh');
 console.log(bill);
}

main().then();
