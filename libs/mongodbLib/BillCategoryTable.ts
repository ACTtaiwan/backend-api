import * as mongodb from 'mongodb'
import { MongoDBTable } from './'
import { MongoDbConfig } from '../../config/mongodb'
import * as dbLib from '../dbLib'
import * as _ from 'lodash'
import { EntryType } from './MongoDBManager';

export class BillCategoryTable extends MongoDBTable {
  public readonly tableName = MongoDbConfig.tableNames.BILLCATEGORIES_TABLE_NAME
  protected readonly suggestPageSize: number = 500

  constructor (db: mongodb.Db) {
    super(db)
  }

  public getAllCategories (): Promise<dbLib.BillCategoryEntity[]> {
    return super.getAllItems<dbLib.BillCategoryEntity>([<any> '_id', 'code', 'name', 'name_zh', 'description', 'description_zh'])
  }

  public getCategoriesById (idx: string[], ...attrNamesToGet: (keyof dbLib.BillCategoryEntity)[]): Promise<dbLib.BillCategoryEntity[]> {
    return super.getItems<dbLib.BillCategoryEntity>('_id', idx, attrNamesToGet)
  }

  public setBillIdArrayToCategory (catId: string, billIdx: string[]): Promise<mongodb.WriteOpResult> {
    return super.updateItemByObjectId<dbLib.BillCategoryEntity>(catId, { billId: _.uniq(billIdx) })
  }

  public addBillToCategory (catId: string, billId: string): Promise<mongodb.WriteOpResult> {
    let updateItem: EntryType<dbLib.BillCategoryEntity> = { 'billId': billId }
    let query = { $addToSet: updateItem }
    return this.getTable<dbLib.BillCategoryEntity>().update({ '_id': catId }, query)
  }

  public removeBillFromCategory (catId: string, billId: string): Promise<mongodb.WriteOpResult> {
    let updateItem: EntryType<dbLib.BillCategoryEntity> = { 'billId': billId }
    let query = { $pull: updateItem }
    return this.getTable<dbLib.BillCategoryEntity>().update({ '_id': catId }, query)
  }

  public removeAllBillsFromCategory (catId: string): Promise<mongodb.WriteOpResult> {
    return super.deleteAttributesFromItem<dbLib.BillCategoryEntity>(catId, ['billId'])
  }
}
