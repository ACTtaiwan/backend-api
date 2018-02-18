import * as dbLib from '../../libs/dbLib/DbLib'
import * as awsConfig from '../../config/aws.json'
import * as _ from 'lodash'

export class CategoryManager {
  private readonly db = dbLib.DynamoDBManager.instance()

  private readonly tblBillName = (<any> awsConfig).dynamodb.VOLUNTEER_BILLS_TABLE_NAME
  public  readonly tblBill = <dbLib.BillTable> this.db.getTable(this.tblBillName)

  private readonly tblCatName = (<any> awsConfig).dynamodb.VOLUNTEER_BILLCATEGORIES_TABLE_NAME
  public  readonly tblCat = <dbLib.BillCategoryTable> this.db.getTable(this.tblCatName)

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

let mngr = new CategoryManager()
mngr.rebuildIndex()
// mngr.resetBillsForCategoryTable()