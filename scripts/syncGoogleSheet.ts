import * as awsConfig from '../config/aws.json'
import GoogleSheetAgent from '../libs/googleApi/GoogleSheetAgent'
import * as dbLib from '../libs/utils/DynamoDBManager'
import * as fs from 'fs'
import * as _ from 'lodash'
import { BillRow } from '../libs/googleApi/CongressSheetModels';
import { v4 as uuid } from 'uuid';

export class GoogleSheetSync {
  private readonly db = dbLib.DynamoDBManager.instance()

  private readonly tblName = (<any> awsConfig).dynamodb.VOLUNTEER_BILLS_TABLE_NAME
  private readonly tbl = <dbLib.BillTable> this.db.getTable(this.tblName)

  private readonly tblBillTypeName = (<any> awsConfig).dynamodb.VOLUNTEER_BILLTYPES_TABLE_NAME
  private readonly tblBillType = <dbLib.BillTypeTable> this.db.getTable(this.tblBillTypeName)

  private readonly tblBillCatName = (<any> awsConfig).dynamodb.VOLUNTEER_BILLCATEGORIES_TABLE_NAME
  private readonly tblBillCat = <dbLib.BillCategoryTable> this.db.getTable(this.tblBillCatName)

  private readonly sheet = new GoogleSheetAgent()

  private types: dbLib.BillTypeEntity[]
  private cats: dbLib.BillCategoryEntity[]

  public async init () {
    this.types = await this.tblBillType.getAllTypes()
    this.cats = await this.tblBillCat.getAllCategories()
  }

  public async syncDb () {
    await this.init()
    const rows: BillRow[] = await this.sheet.getBillSheet()
    const billsToDelete = await this.tbl.getAllBills('id', 'congress', 'billType', 'billNumber')
    const billsToUpdate: [BillRow, dbLib.BillEntity][] = []
    const billsToAdd: BillRow[] = []
    _.each(rows, async row => {
      let bill = _.find(billsToDelete, b =>
          b.congress === row.congress
        && this.stringCompare(b.billType.display, row.billTypeDisplay)
        && b.billNumber === row.billNumber)

      if (bill) {
        billsToUpdate.push([row, bill])
        _.remove(billsToDelete, bill)
      } else {
        billsToAdd.push(row)
      }
    })

    this.printInfo(billsToAdd, billsToUpdate, billsToDelete)

    // update bills
    if (billsToUpdate.length > 0) {
      console.log('Updating bills...')
      const batchSize = 20
      while (!_.isEmpty(billsToUpdate)) {
        console.log(`Remaining ${billsToUpdate.length} bills`)
        const batch = billsToUpdate.splice(0, batchSize)
        await this.batchUpdate(batch)
      }
    }

    // add bills
    if (billsToAdd.length > 0) {
      console.log('Adding bills...')
      this.addBills(billsToAdd)
    }

    // delete bills
    if (billsToDelete.length > 0) {
      console.log('Deleting bills...')
      await this.tbl.deleteBills(_.map(billsToDelete, x => x.id))
    }
  }

  public async test () {
    let idx = ['9bff167a-847c-4dd2-9732-315dd0828529', '8aa68d48-540a-4103-ba89-cad7b3fe5c42']
    let objs = await this.tbl.getBillsById(idx)
    console.log(JSON.stringify(objs, null, 2))
  }

  public async addBills (billsToAdd: BillRow[]) {
    for (let i = 0; i < billsToAdd.length; ++i) {
      const b = billsToAdd[i]
      console.log(`Adding bill (${i} / ${billsToAdd.length}) ${this.displayRow(b)}`)
      await this.addBill(b)
    }
  }

  public addBill (billRow: BillRow) {
    const typeToAdd = _.find(this.types, t => t.display === billRow.billTypeDisplay)
    const entity: dbLib.BillEntity = {
      id: <string> uuid(),
      congress: billRow.congress,
      billType: typeToAdd,
      billNumber: billRow.billNumber,
      title: billRow.title
    }

    // extension fields
    const optionals = _.pick(billRow, 'title_zh', 'tags', 'relevence', 'china', 'insight', 'comment')
    _.assign(entity, optionals)

    // categories
    const catsFound = this.findCategories(billRow)
    entity.categories = catsFound

    return this.tbl.putBill(entity)
  }

  public async batchUpdate (billsToUpdate: [BillRow, dbLib.BillEntity][]) {
    let billIdRowMap = {}
    _.each(billsToUpdate, x => billIdRowMap[ x[1].id ] = x[0])

    const billIdx = _.keys(billIdRowMap)
    const fullBills = await this.tbl.getBillsById(billIdx)
    let billIdEntityMap = _.keyBy(fullBills, 'id')

    console.log(`Updating ${JSON.stringify(billIdx, null, 2)}`)
    for (let i = 0; i < billIdx.length; ++i) {
      const billId = billIdx[i]
      const row = billIdRowMap[billId]
      const bill = billIdEntityMap[billId]
      await this.updateBill(row, bill)
    }
  }

  public async updateBill (row: BillRow, bill: dbLib.BillEntity) {
    let update = <dbLib.BillEntity> {}

    let updateLiteralField = (name: keyof BillRow, overwrite: boolean = true) => {
      if (row[name]) {
        if (!bill[name]) {
          console.log(`${this.displayBill(bill)} -> ${name}: invalid (empty to assign)`)
          update[name] = row[name]
        } else {
          const notEqual = row[name] !== bill[name]
          if (notEqual) {
            if (overwrite) {
              console.log(`${this.displayBill(bill)} -> ${name}: invalid (existing to update)`)
              update[name] = row[name]
            } else {
              console.log(`${this.displayBill(bill)} -> ${name}: invalid (existing NOT to update)`)
            }
          }
        }
      }
    }

    updateLiteralField('title', false)
    updateLiteralField('title_zh')
    updateLiteralField('relevence')
    updateLiteralField('china')
    updateLiteralField('insight')
    updateLiteralField('comment')

    if (row.tags && row.tags.length > 0) {
      if (!bill.tags) {
        console.log(`${this.displayBill(bill)} -> tags: invalid (empty to assign)`)
        update.tags = row.tags
      } else {
        const notEqual = (row.tags.length !== bill.tags.length) || !_.isEqual(row.tags.sort(), bill.tags.sort())
        if (notEqual) {
          console.log(`${this.displayBill(bill)} -> tags: invalid (existing to update)`)
          // update.tags = _.uniq(_.concat(bill.tags, row.tags)) // merge
          update.tags = row.tags // overwrite
        }
      }
    }

    if (row.categories && row.categories.length > 0) {
      const catsFound = this.findCategories(row)
      if (!bill.categories) {
        console.log(`${this.displayBill(bill)} -> categories: invalid (empty to assign)`)
        update.categories = catsFound
      } else {
        const notEqual = (catsFound.length !== bill.categories.length)
                      || !_.isEqualWith(_.sortBy(catsFound, 'id'), _.sortBy(bill.categories, 'id'), (x, y) => x.id === y.id)
        if (notEqual) {
          console.log(`${this.displayBill(bill)} -> categories: invalid (existing to update)`)
          // update.categories = _.uniqBy(_.concat(bill.categories, catsFound), 'id') // merge
          update.categories = catsFound // overwrite
        }
      }
    }

    if (!_.isEmpty(update)) {
      console.log(`Incremental bill update = ${JSON.stringify(update, null, 2)}`)
      return this.tbl.updateBill(bill.id, update)
    } else {
      return Promise.resolve()
    }
  }

  public async removeJustAddedBills () {
    const bills = await this.tbl.getAllBillsNotHavingAttributes(['currentChamber', 'actions', 'trackers', 'sponsor', 'cosponsors'], 'id')
    const idx = _.map(bills, x => x.id)
    await this.tbl.deleteBills(idx)
  }

  private findCategories (row: BillRow): dbLib.BillCategoryEntity[] {
    const found: dbLib.BillCategoryEntity[] = []
    if (row.categories && row.categories.length > 0) {
      _.each(row.categories, rowCat => {
        let cat = _.find(this.cats, c => this.stringCompare(c.name, rowCat))
        if (!cat) {
          console.log(`Cannot find category '${rowCat}' for row = ${this.displayRow(row)}`)
        } else {
          found.push(cat)
        }
      })
    }
    return found
  }

  private stringCompare (str1: string, str2: string): boolean {
    let removeSecialChars = (str: string) => str.replace(/[^a-zA-Z ]/g, '')
    return removeSecialChars(str1).toLocaleLowerCase()
      === removeSecialChars(str2).toLocaleLowerCase()
  }

  private printInfo (billsToAdd: BillRow[], billsToUpdate: [BillRow, dbLib.BillEntity][], billsToDelete: dbLib.BillEntity[]): void {
    console.log(`# of bills to add = ${billsToAdd.length}`)
    console.log(JSON.stringify(_.map(billsToAdd, x => this.displayRow(x)), null, 2))
    console.log(`# of bills to update = ${billsToUpdate.length}`)
    console.log(JSON.stringify(_.map(billsToUpdate, x => this.displayBill(x[1])), null, 2))
    console.log(`# of bills to delete = ${billsToDelete.length}`)
    console.log(JSON.stringify(_.map(billsToDelete, x => this.displayBill(x)), null, 2))
  }

  private displayRow (row: BillRow) {
    return row.congress + '-' + row.billTypeDisplay + '-' + row.billNumber
  }

  private displayBill (bill: dbLib.BillEntity) {
    return `${bill.congress}-${bill.billType.code}-${bill.billNumber} (${bill.id})`
  }
}

let sync = new GoogleSheetSync()
// sync.removeJustAddedBills()
// sync.test()
sync.syncDb()
