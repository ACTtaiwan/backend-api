import * as mongoDbLib from '../../../libs/mongodbLib'
import { MongoDbConfig } from '../../../config/mongodb'
import * as dbLib from '../../../libs/dbLib'
import * as _ from 'lodash'

const tblName = MongoDbConfig.tableNames.BILLVERSIONS_TABLE_NAME

class TestBillVersionTable {
  public static async getVersionByCode () {
    let tbl = await TestBillVersionTable.getTable()
    let ver = await tbl.getVersionByCode('rcs')
    console.log(JSON.stringify(ver, null, 2))
  }

  private static async getTable () {
    const db = await mongoDbLib.MongoDBManager.instance
    const tblCat = db.getTable<mongoDbLib.BillVersionTable>(tblName)
    return tblCat
  }
}

TestBillVersionTable.getVersionByCode()