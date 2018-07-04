import * as mongodb from 'mongodb'
import { MongoDBTable } from './'
import { MongoDbConfig } from '../../config/mongodb'
import * as dbLib from '../dbLib'
import * as _ from 'lodash'
import { v4 as uuid } from 'uuid';
import { EntryType } from './MongoDBManager';

export class TagMetaTable extends MongoDBTable {
  public readonly tableName = MongoDbConfig.tableNames.TAGS_TABLE_NAME
  protected readonly suggestPageSize: number = 1000

  constructor (db: mongodb.Db) {
    super(db)
  }

  public putMetaInfo (obj: dbLib.TagMetaEntity): Promise<dbLib.TagMetaEntity> {
    return super.putItem<dbLib.TagMetaEntity>(obj)
  }

  public updateMetaInfo (id: string, updateMeta: dbLib.TagMetaEntity): Promise<mongodb.WriteOpResult> {
    return super.updateItemByObjectId<dbLib.TagMetaEntity>(id, updateMeta)
  }

  public getAllMetaInfo (): Promise<dbLib.TagMetaEntity[]> {
    return super.getAllItems<dbLib.TagMetaEntity>()
  }

  public deleteMetaInfo (idx: string[]): Promise<mongodb.WriteOpResult> {
    return (idx && idx.length > 0) ? super.deleteItems(idx) : Promise.resolve(null)
  }
}

export class TagTable extends MongoDBTable {
  public readonly tableName = MongoDbConfig.tableNames.TAGS_TABLE_NAME
  protected readonly suggestPageSize: number = 1000

  constructor (db: mongodb.Db) {
    super(db)
  }

  public putTag (obj: dbLib.TagEntity): Promise<dbLib.TagEntity> {
    return super.getTable<dbLib.TagEntity>().update(
        { tag: obj.tag },
        { $set: obj },
        { upsert: true }
      ).then(() => obj)
  }

  public getTag (tag: string, ...attrNamesToGet: (keyof dbLib.TagEntity)[]): Promise<dbLib.TagEntity> {
    return super.queryItemOne<dbLib.TagEntity>({tag}, attrNamesToGet)
  }

  public getTags (tags: string[], ...attrNamesToGet: (keyof dbLib.TagEntity)[]): Promise<dbLib.TagEntity[]> {
    return super.queryItems<dbLib.TagEntity>({tag: {$in: tags}}, attrNamesToGet)
  }

  public getAllTags (...attrNamesToGet: (keyof dbLib.TagEntity)[]): Promise<dbLib.TagEntity[]> {
    return super.getAllItems<dbLib.TagEntity>(attrNamesToGet)
  }

  public searchTags (
    q: string,
    attrNamesToGet?: (keyof dbLib.TagEntity)[],
    maxSearchItems?: number,
    op: 'contains' | 'begins_with' | 'regex' = 'begins_with'
  ): Promise<dbLib.TagEntity[]> {

    let queryItems = (query) => {
      let prjFields = this.composeProjectFields<dbLib.TagEntity>(attrNamesToGet)
      let cursor = this.getTable<dbLib.TagEntity>().find(query, prjFields)
      if (maxSearchItems && maxSearchItems > 0) {
        cursor = cursor.limit(maxSearchItems)
      }
      return cursor.toArray()
    }

    switch (op) {
      case 'contains':
      case 'regex':
        let reqex1 = new RegExp(q, 'ig')
        return queryItems({tag: { $regex: reqex1 }})

      case 'begins_with':
        let reqex2 = new RegExp('^' + q, 'ig')
        return queryItems({tag: { $regex: reqex2 }})
    }
    return Promise.resolve([])
  }

  public updateTotalUserCount (tag: string, totalUserCount: number): Promise<mongodb.WriteOpResult> {
    return this.getTable<dbLib.TagTable>().update(
      { tag },
      { $set: { totalUserCount } },
      { upsert: true, multi: false}
    )
  }

  public setBillIdArrayToTag (tag: string, billIdx: string[]): Promise<mongodb.WriteOpResult> {
    let query = { $set: { billId: _.uniq(billIdx) } }
    return this.getTable<dbLib.BillEntity>().update({ tag }, query)
  }

  public addBillToTag (tag: string, billId: string): Promise<mongodb.WriteOpResult> {
    let updateItem: EntryType<dbLib.TagEntity> = { 'billId': billId }
    let query = { $addToSet: updateItem }
    return this.getTable<dbLib.TagTable>().update({ tag }, query)
  }

  public removeBillFromTag (tag: string, billId: string): Promise<mongodb.WriteOpResult> {
    let updateItem: EntryType<dbLib.TagEntity> = { 'billId': billId }
    let query = { $pull: updateItem }
    return this.getTable<dbLib.TagTable>().update({ tag }, query)
  }

  public deleteTag (tag: string): Promise<mongodb.DeleteWriteOpResultObject> {
    return tag
      ? super.getTable<dbLib.TagTable>().deleteOne({tag})
      : Promise.resolve(null)
  }

  public deleteTags (tags: string[]): Promise<mongodb.DeleteWriteOpResultObject> {
    return (tags && tags.length > 0)
      ? super.getTable<dbLib.TagTable>().deleteMany({tag: {$in: tags}})
      : Promise.resolve(null)
  }
}
