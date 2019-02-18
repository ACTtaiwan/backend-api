import { NLPEngineAgent } from '../../libs/nlp/NLPEngineAgent';
import * as mongoDbLib from '../../libs/mongodbLib';
import { MongoDbConfig } from '../../config/mongodb';

const tblName = MongoDbConfig.tableNames.BILLS_TABLE_NAME;

let test = async () => {
  let nlp = new NLPEngineAgent();
  let keys = await nlp.findKeywords(`
    Not later than 180 days after the date of the enactment of this Act, and every 180 days thereafter, the Secretary of State shall submit to the Committee on Foreign Relations of the Senate and the Committee on Foreign Affairs of the House of Representatives a report on travel by United States executive branch officials to Taiwan.
  `);
  console.log(JSON.stringify(keys, null, 2));
};

let test2 = async () => {
  let nlp = new NLPEngineAgent();
  let tbl = await getTable();
  let bill = await tbl.getBillById('9be9e553-f2b3-48b3-a7f2-87dfb369c7a8');
  let keys = await nlp.findKeywordOfLatestVersion(bill);
  console.log(JSON.stringify(keys, null, 2));
};

let getTable = async () => {
  const db = await mongoDbLib.MongoDBManager.instance;
  const tblCat = db.getTable<mongoDbLib.BillTable>(tblName);
  return tblCat;
};

test2();
