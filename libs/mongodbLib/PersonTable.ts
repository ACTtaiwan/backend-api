import * as mongodb from 'mongodb'
import { MongoDBTable } from './'
import { MongoDbConfig } from '../../config/mongodb'
import * as dbLib from '../dbLib'
import * as _ from 'lodash'

export class PersonTable extends MongoDBTable {
  public readonly tableName = MongoDbConfig.tableNames.PERSON_TABLE_NAME
  protected readonly suggestPageSize: number = 1000

  public static readonly MAX_SEARCH_TOKENS = 5

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

    let query = {}

    let tokens = (q.match(/\S+/g) || []).slice(0, PersonTable.MAX_SEARCH_TOKENS);
    if (tokens && tokens.length > 0) {
      let conditions: {[key in keyof dbLib.PersonEntity]?: any}[] = []
      _.each(tokens, token =>  {
        let regExp = new RegExp(token, 'ig')
        conditions.push({ 'searchName': { $regex: regExp } })
      })

      if (conditions.length > 0) {
        query['$and'] = conditions
      }
    }

    console.log('[PersonTable::searchPerson()] q = ' + q)
    console.log('[PersonTable::searchPerson()] tokens = ' + tokens)
    console.log(`[PersonTable::searchPerson()] query = ${JSON.stringify(query, null, 2)}`)

    let queryItems = (query) => {
      let prjFields = this.composeProjectFields<dbLib.PersonEntity>(attrNamesToGet)
      let cursor = this.getTable<dbLib.PersonEntity>().find(query, prjFields)
      if (maxSearchItems && maxSearchItems > 0) {
        cursor = cursor.limit(maxSearchItems)
      }
      return cursor.toArray()
        .then(res => super.addBackIdField(res))
    }

    const perfMark = '[PersonTable::searchPerson()] search time'
    console['time'](perfMark)
    return queryItems(query)
      .then(items => {
        console['timeEnd'](perfMark)
        return items
      })
  }

  public updatePerson (id: string, item: dbLib.PersonEntity): Promise<mongodb.WriteOpResult> {
    return super.updateItemByObjectId<dbLib.BillCategoryEntity>(id, item)
  }
}
