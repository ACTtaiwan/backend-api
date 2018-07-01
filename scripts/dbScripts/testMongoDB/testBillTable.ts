import * as mongoDbLib from '../../../libs/mongodbLib'
import { MongoDbConfig } from '../../../config/mongodb'
import * as dbLib from '../../../libs/dbLib'
import * as _ from 'lodash'

const tblName = MongoDbConfig.tableNames.BILLS_TABLE_NAME

class TestBillTable {
  public static async putBill () {
    let tbl = await TestBillTable.getTable()

    let item1 = await tbl.putBill(<dbLib.BillEntity> {
      id: '9be9e553-f2b3-48b3-a7f2-87dfb369c7a8'
    });
    console.log(JSON.stringify(item1, null, 2))

    let item2 = await tbl.putBill(<dbLib.BillEntity> {
      congress: 1000
    });
    console.log(JSON.stringify(item2, null, 2))
  }

  public static async createEmptyTagsAttrForBill () {
    let tbl = await TestBillTable.getTable()
    await tbl.createEmptyTagsAttrForBill('20a322f0-98f6-49e9-b2ab-f61e87e848c5')
  }

  public static async addTagToBill () {
    let tbl = await TestBillTable.getTable()

    await tbl.putBill(<dbLib.BillEntity> {
      id: 'test-bill',
      tags: [
        { tag: 'ttttaaaggg', userVote: <dbLib.BillTagUserVote> { 'bbb': 123 } }
      ]
    });
    console.log(JSON.stringify(await tbl.getBillById('test-bill', 'tags'), null, 2))

    await tbl.addTagToBill('ttttaaaggg', 'test-bill');
    console.log(JSON.stringify(await tbl.getBillById('test-bill', 'tags'), null, 2))
  }

  public static async getBillById () {
    let tbl = await TestBillTable.getTable()
    let bill = await tbl.getBillById('398120ed-9c79-448a-87c0-d5479a528ec4', 'id', 'sponsor', 'cosponsors')
    console.log(JSON.stringify(bill, null, 2))
  }

  public static async getAllBillsHavingAttributes () {
    let tbl = await TestBillTable.getTable()
    let bills = await tbl.getAllBillsHavingAttributes(['sponsorRoleId', 'cosponsors'], 'id')
    console.log(JSON.stringify(bills, null, 2))
  }

  public static async queryBillsByCongress () {
    let tbl = await TestBillTable.getTable()
    let bills = await tbl.queryBillsByCongress(115, ['id', 'title', 'congress', 'billType', 'billNumber'])
    console.log(JSON.stringify(bills, null, 2))
  }

  public static async updateTagUserCount () {
    let tbl = await TestBillTable.getTable()
    const billId = '9be9e553-f2b3-48b3-a7f2-87dfb369c7a8'
    const uId = 'abe9e553-f2b3-48b3-a7f2-87dfb369c7af'
    console.log(JSON.stringify(await tbl.getBillById(billId, 'tags'), null, 2))

    await tbl.updateTagUserCount('lee teng-hui', billId, uId, 100)
    console.log(JSON.stringify(await tbl.getBillById(billId, 'tags'), null, 2))
  }

  public static async clearTagUserCount () {
    let tbl = await TestBillTable.getTable()
    const billId = '9be9e553-f2b3-48b3-a7f2-87dfb369c7a8'
    console.log(JSON.stringify(await tbl.getBillById(billId, 'tags'), null, 2))

    await tbl.clearTagUserCount('lee teng-hui', billId)
    console.log(JSON.stringify(await tbl.getBillById(billId, 'tags'), null, 2))
  }

  private static async getTable () {
    const db = await mongoDbLib.MongoDBManager.instance
    const tblCat = db.getTable<mongoDbLib.BillTable>(tblName)
    return tblCat
  }
}

// TestBillTable.putBill()
// TestBillTable.createEmptyTagsAttrForBill()
// TestBillTable.addTagToBill()
// TestBillTable.getBillById()
// TestBillTable.getAllBillsHavingAttributes()
TestBillTable.queryBillsByCongress()
// TestBillTable.updateTagUserCount()
// TestBillTable.clearTagUserCount()