import * as mongoDbLib from '../../../libs/mongodbLib'
import { MongoDbConfig } from '../../../config/mongodb'
import * as dbLib from '../../../libs/dbLib'
import * as _ from 'lodash'

const tblName = MongoDbConfig.tableNames.PERSON_TABLE_NAME

class TestPersonTable {
  public static async forEachBatchOfAllPersons () {
    let tbl = await TestPersonTable.getTable()
    let total = 0
    await tbl.forEachBatchOfAllPersons(async batch => {
      total += batch.length
      console.log(`[BATCH] size = ${batch.length} / total = ${total}`)
    }, ['bioGuideId']);
  }

  public static async getPersonByBioGuideId () {
    let tbl = await TestPersonTable.getTable()
    let person = await tbl.getPersonByBioGuideId('B001166')
    console.log(JSON.stringify(person, null, 2))
  }

  public static async searchPerson () {
    let tbl = await TestPersonTable.getTable()
    let persons = await tbl.searchPerson('jim leach', ['id', 'firstname', 'lastname', 'middlename', 'searchName'])
    console.log(JSON.stringify(persons, null, 2))
  }

  public static async updatePerson () {
    let tbl = await TestPersonTable.getTable()
    const pid = '9d382f05-d628-4635-907d-af96ee7302d6'
    await tbl.updatePerson(pid, <any> { test: 'ttt' })
    let person = await tbl.getPersonsById([pid])
    console.log(JSON.stringify(person, null, 2))
  }

  private static async getTable () {
    const db = await mongoDbLib.MongoDBManager.instance
    const tblCat = db.getTable<mongoDbLib.PersonTable>(tblName)
    return tblCat
  }
}

// TestPersonTable.forEachBatchOfAllPersons()
// TestPersonTable.getPersonByBioGuideId()
TestPersonTable.searchPerson()
// TestPersonTable.updatePerson()