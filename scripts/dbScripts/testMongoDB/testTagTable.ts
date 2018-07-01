import * as mongoDbLib from '../../../libs/mongodbLib'
import { MongoDbConfig } from '../../../config/mongodb'
import * as _ from 'lodash'

const tblName = MongoDbConfig.tableNames.TAGS_TABLE_NAME

class TestTagTable {
  public static async putTag () {
    const tbl = await TestTagTable.getTable()
    await tbl.putTag({tag: 'XXX'})
    const tag = await tbl.getTag('XXX')
    console.log(JSON.stringify(tag, null, 2))
  }

  private static async getTable () {
    const db = await mongoDbLib.MongoDBManager.instance
    const tblCat = db.getTable<mongoDbLib.TagTable>(tblName)
    return tblCat
  }
}

TestTagTable.putTag()
