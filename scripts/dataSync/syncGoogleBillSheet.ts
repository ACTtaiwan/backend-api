import * as awsConfig from '../../config/aws.json'
import { GoogleSheetAgent } from '../../libs/googleApi/GoogleSheetAgent'
import * as dbLib from '../../libs/dbLib'
import * as fs from 'fs'
import * as _ from 'lodash'
import { BillRow, CategoryRow } from '../../libs/googleApi/CongressSheetModels';
import { v4 as uuid } from 'uuid';
import { TagManager } from '../../libs/dataManager/TagManager';
import { CategoryManager } from '../../libs/dataManager/CategoryManager';

export class GoogleBillSheetSyncOption {
  syncBasicInfo?: boolean = true
  syncCategories?: boolean = true
  syncTags?: boolean = true
}

export class GoogleBillSheetSync {
  private readonly db = dbLib.DynamoDBManager.instance()

  private readonly tblName = (<any> awsConfig).dynamodb.VOLUNTEER_BILLS_TABLE_NAME
  private readonly tbl = <dbLib.BillTable> this.db.getTable(this.tblName)

  private readonly tblBillTypeName = (<any> awsConfig).dynamodb.VOLUNTEER_BILLTYPES_TABLE_NAME
  private readonly tblBillType = <dbLib.BillTypeTable> this.db.getTable(this.tblBillTypeName)

  private readonly tblBillCatName = (<any> awsConfig).dynamodb.VOLUNTEER_BILLCATEGORIES_TABLE_NAME
  private readonly tblBillCat = <dbLib.BillCategoryTable> this.db.getTable(this.tblBillCatName)

  private readonly sheet = new GoogleSheetAgent()
  private readonly categoryManager = new CategoryManager()

  private types: dbLib.BillTypeEntity[]
  private cats: dbLib.BillCategoryEntity[]
  private catRows: CategoryRow[]

  public async syncDb (options: GoogleBillSheetSyncOption = new GoogleBillSheetSyncOption()) {
    const rows: BillRow[] = await this.sheet.getBillSheet()
    const billsToDelete = await this.tbl.getAllBills('id', 'congress', 'billType', 'billNumber', 'tags')
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
        await this.batchUpdate(batch, options)
      }
    }

    // add bills
    if (billsToAdd.length > 0) {
      console.log('Adding bills...')
      await this.addBills(billsToAdd)
    }

    // delete bills
    if (billsToDelete.length > 0) {
      console.log('Deleting bills...')
      await this.tbl.deleteBills(_.map(billsToDelete, x => x.id))
    }

    // rebuild category index
    console.log(`Rebuilding category index...`)
    await options.syncCategories && this.categoryManager.rebuildIndex()
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

  public async addBill (billRow: BillRow) {
    if (!this.types) {
      this.types = await this.tblBillType.getAllTypes()
    }
    const typeToAdd = _.find(this.types, t => t.display === billRow.billTypeDisplay)
    const entity = <dbLib.BillEntity> {
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
    const catsFound = await this.findCategories(billRow.categories)
    entity.categories = catsFound

    return this.tbl.putBill(entity)
  }

  public async batchUpdate (billsToUpdate: [BillRow, dbLib.BillEntity][], options: GoogleBillSheetSyncOption) {
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
      options.syncBasicInfo && await this.updateBill(row, bill)
      options.syncTags && await this.updateTag(row, bill)
      options.syncCategories && await this.updateCategory(row, bill)
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

    updateLiteralField('title')
    updateLiteralField('title_zh')
    updateLiteralField('relevence')
    updateLiteralField('china')
    updateLiteralField('insight')
    updateLiteralField('comment')

    if (!_.isEmpty(update)) {
      console.log(`Incremental bill update = ${JSON.stringify(update, null, 2)}`)
      return this.tbl.updateBill(bill.id, update)
    } else {
      return Promise.resolve()
    }
  }

  public async updateTag (row: BillRow, bill: dbLib.BillEntity) {
    let tagMngr = new TagManager()
    if (row && row.tags && row.tags.length > 0) {
      let rowTags: string[] = _.chain(row.tags).filter(x => x).map(x => x.toLowerCase()).value()
      let existingTags: string[] = (bill && bill.tags && _.keys(bill.tags)) || []
      let interTags = _.intersection(rowTags, existingTags)

      // add tags
      let addTags = _.difference(rowTags, interTags)
      if (addTags.length > 0) {
        console.log(`${this.displayBill(bill)} -> addTags = ${JSON.stringify(addTags)}`)
        for (let i = 0; i < addTags.length; ++i) {
          let tag = addTags[i]
          console.log(`${this.displayBill(bill)} -> add tag: ${tag}`)
          await tagMngr.addTagToBill(tag, bill.id)
        }
      }

      // delete tags
      let delTags = _.difference(existingTags, interTags)
      if (delTags.length > 0) {
        console.log(`${this.displayBill(bill)} -> delTags = ${JSON.stringify(delTags)}`)
        for (let i = 0; i < delTags.length; ++i) {
          let tag = delTags[i]
          console.log(`${this.displayBill(bill)} -> delete tag: ${tag}`)
          await tagMngr.removeTagFromBill(tag, bill.id)
        }
      }
    }
  }

  public async updateCategory (row: BillRow, bill: dbLib.BillEntity) {
    let update = <dbLib.BillEntity> {}

    if (row.categories && row.categories.length > 0) {
      const catsFound = await this.findCategories(row.categories)
      if (!bill.categories) {
        console.log(`${this.displayBill(bill)} -> categories: invalid (empty to assign)`)
        update.categories = catsFound
      } else {
        const notEqual = (catsFound.length !== bill.categories.length)
                      || !_.isEqualWith(_.sortBy(catsFound, 'id'), _.sortBy(bill.categories, 'id'), (x, y) => x.id === y.id)
        if (notEqual) {
          console.log(`${this.displayBill(bill)} -> categories: invalid (existing to update)`)
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

  public async findCategories (categories: string[]): Promise<dbLib.BillCategoryEntity[]> {
    if (!this.cats) {
      this.cats = await this.tblBillCat.getAllCategories()
    }
    if (!this.catRows) {
      this.catRows = await this.sheet.getCategorySheet()
    }
    const found: CategoryRow[] = []
    if (categories && categories.length > 0) {
      _.each(categories, rowCat => {
        let cat = _.find(this.catRows, c => this.stringCompare(c.displayName, rowCat))
        if (!cat) {
          console.log(`Cannot find category '${rowCat}'`)
        } else {
          found.push(cat)
        }
      })
    }

    const dbEntityCodeMap = _.keyBy(this.cats, 'code')
    const dbEntities = _.filter(_.map(found, x => dbEntityCodeMap[x.code]), _.identity)
    return _.clone(dbEntities)
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

let sync = new GoogleBillSheetSync()
// sync.removeJustAddedBills()
// sync.test()
sync.syncDb({syncBasicInfo: false, syncTags: false, syncCategories: true})
