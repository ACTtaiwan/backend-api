import * as dbLib from '../../libs/dbLib'
import * as mongoDbLib from '../../libs/mongodbLib'
import { MongoDbConfig } from '../../config/mongodb'
import * as _ from 'lodash'

export class CategoryManager {
  private tblBill: mongoDbLib.BillTable
  private tblCat: mongoDbLib.BillCategoryTable

  public async init () {
    if (!this.tblBill || !this.tblCat) {
      const db = await mongoDbLib.MongoDBManager.instance

      const tblBillName = MongoDbConfig.tableNames.BILLS_TABLE_NAME
      this.tblBill = db.getTable(tblBillName)

      const tblCatName = MongoDbConfig.tableNames.BILLCATEGORIES_TABLE_NAME
      this.tblCat = db.getTable(tblCatName)
    }
  }

  public async rebuildIndex () {
    const cats = await this.tblCat.getAllCategories()
    console.log(`\n---------------------------------- Clean up ----------------------------------\n`)
    await this.resetBillsForCategoryTable(cats)

    const bills = await this.tblBill.getAllBills('id', 'congress', 'billNumber', 'billType', 'categories')
    const billsWithCats = _.filter(bills, b => b.categories && b.categories.length > 0)

    for (let b = 0; b < billsWithCats.length; ++b) {
      const bill = billsWithCats[b]
      const billDisplay = dbLib.DbHelper.displayBill(bill)
      console.log(`\n---------------------------------- Updating ${billDisplay} ----------------------------------\n`)
      for (let i = 0; i < bill.categories.length; ++i) {
        const cat = bill.categories[i]
        await this.tblCat.addBillToCategory(cat.id, bill.id)
      }
    }
  }

  public async resetBillsForCategoryTable (cats?: dbLib.BillCategoryEntity[]) {
    if (!cats) {
      cats = await this.tblCat.getAllCategories()
    }
    for (let c = 0; c < cats.length; ++c) {
      await this.tblCat.removeAllBillsFromCategory(cats[c].id)
    }
  }
}
