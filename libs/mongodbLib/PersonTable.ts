import * as mongodb from 'mongodb'
import { MongoDBTable } from './'
import { MongoDbConfig } from '../../config/mongodb'
import * as dbLib from '../dbLib'

export class PersonTable extends MongoDBTable {
  public readonly tableName = MongoDbConfig.tableNames.PERSON_TABLE_NAME
  protected readonly suggestPageSize: number = 1000

  constructor (db: mongodb.Db) {
    super(db)
  }

  public putPerson (item: dbLib.PersonEntity): Promise<dbLib.PersonEntity> {
    return super.putItem(item)
  }

  public getPersonsById (idx: string[], ...attrNamesToGet: (keyof dbLib.PersonEntity)[]): Promise<dbLib.PersonEntity[]> {
    return super.getItems<dbLib.PersonEntity>('_id', idx, attrNamesToGet)
  }

  public getAllPersons (...attrNamesToGet: (keyof dbLib.PersonEntity)[]): Promise<dbLib.PersonEntity[]> {
    return super.getAllItems<dbLib.PersonEntity>(attrNamesToGet)
  }

  public async forEachBatchOfAllPersons (
    callback: (batchRoles: dbLib.PersonEntity[]) => Promise<boolean | void>,
    attrNamesToGet?: (keyof dbLib.PersonEntity)[]
  ): Promise<void> {
    return super.forEachBatch<dbLib.PersonEntity>(callback, attrNamesToGet)
  }

  public getPersonByBioGuideId (bioGuideId: string, attrNamesToGet?: (keyof dbLib.PersonEntity)[]): Promise<dbLib.PersonEntity> {
    return super.queryItems<dbLib.PersonEntity>({ bioGuideId }, attrNamesToGet)
      .then(results => (results && results[0]) || null)
  }

  public searchPerson (
    q: string,
    attrNamesToGet?: (keyof dbLib.PersonEntity)[],
    maxSearchItems?: number,
    op: 'contains' | 'begins_with' | 'regex' = 'contains'
  ): Promise<dbLib.PersonEntity[]> {

    let queryItems = (query) => {
      let prjFields = this.composeProjectFields<dbLib.PersonEntity>(attrNamesToGet)
      let cursor = this.getTable<dbLib.PersonEntity>().find(query, prjFields)
      if (maxSearchItems && maxSearchItems > 0) {
        cursor = cursor.limit(maxSearchItems)
      }
      return cursor.toArray().then(res => super.addBackIdField(res))
    }

    let makeRegExp = () => {
      switch (op) {
        case 'contains':
        case 'regex':
          return new RegExp(q, 'ig')

        case 'begins_with':
          return new RegExp('^' + q, 'ig')
      }
    }

    let regExp = makeRegExp()
    return queryItems({ searchName: { $regex: regExp } })
  }

  public updatePerson (id: string, item: dbLib.PersonEntity): Promise<mongodb.WriteOpResult> {
    return super.updateItemByObjectId<dbLib.BillCategoryEntity>(id, item)
  }
}
