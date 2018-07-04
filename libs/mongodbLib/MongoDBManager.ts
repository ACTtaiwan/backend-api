import * as mongodb from 'mongodb';
import * as _ from 'lodash';
import { MongoDbConfig } from '../../config/mongodb';
import * as dbLib from '../dbLib';
import * as mongoDbLib from './';
import { v4 as uuid } from 'uuid';

export class MongoDBManager {
  private static _instance: MongoDBManager;
  private db: mongodb.Db;
  private tables: {[name: string]: MongoDBTable} = {}

  public static get instance (): Promise<MongoDBManager> {
    if (!MongoDBManager._instance) {
      MongoDBManager._instance = new MongoDBManager();
    }
    return MongoDBManager._instance.init().then(() => MongoDBManager._instance);
  }

  public dropDatabase (): Promise<void> {
    return this.db.dropDatabase();
  }

  public insertObjects (tableName: string, objs: any[]): Promise<mongodb.InsertWriteOpResult> {
    return this.getCollection(tableName).then(collection => {
      console.log(`[INSERT] TABLE = ${tableName}, OBJS = ${objs.length}`);
      return new Promise<mongodb.InsertWriteOpResult>(async (resolve, reject) => {
        let res: mongodb.InsertWriteOpResult;
        try {
          res = await collection.insertMany(objs);
        } catch (err) {
          if (err) {
            console.log(err);
            reject(err)
          }
        }
        resolve(res);
      });
    });
  }

  public getTable<T extends dbLib.Table> (tableName: string): T {
    return <T> (this.tables[tableName] as dbLib.Table)
  }

  public getCollection (name: string): Promise<mongodb.Collection<any>> {
    return this.db.collections().then(collections => {
      let collection = _.find(collections, x => x.collectionName === name);
      if (collection) {
        return collection;
      } else {
        return new Promise<mongodb.Collection<any>>((resolve, reject) => {
          this.db.createCollection(name, (err, res) => {
            if (err) {
              reject(err);
            } else {
              resolve(res);
            }
          });
        });
      }
    });
  }

  private init (): Promise<void> {
    if (this.db) {
      return Promise.resolve();
    } else {
      return MongoDbConfig.connectionUrl
        .then(dbUrl => mongodb.MongoClient.connect(dbUrl))
        .then(db => {
          console.log(`[MongoDBManager] DB connected`)
          this.db = db;
          const tables = <MongoDBTable[]> [
            new mongoDbLib.BillCategoryTable(this.db),
            new mongoDbLib.BillTable(this.db),
            new mongoDbLib.BillTypeTable(this.db),
            new mongoDbLib.BillVersionTable(this.db),
            new mongoDbLib.PersonTable(this.db),
            new mongoDbLib.RoleTable(this.db),
            new mongoDbLib.TagMetaTable(this.db),
            new mongoDbLib.TagTable(this.db),
            new mongoDbLib.CongressGovSyncBillTable(this.db)
          ]
          this.tables = _.keyBy(tables, x => x.tableName)
        }).catch(err => {
          console.log(`[MongoDBManager] DB connect error = ${JSON.stringify(err, null, 2)}`)
          throw err
        })
    }
  }
}

export type MongoDBProjectQueryType = {[key: string]: 1}

export type EntryType<T extends dbLib.TableEntity> = {[key in (keyof T)]?: T[key] | number | string}

export abstract class MongoDBTable<HydrateField = string> extends dbLib.Table<HydrateField> {
  public static readonly AZURE_MAX_QUERY_ITEMS = 500
  protected abstract get suggestPageSize (): number
  protected db: mongodb.Db

  constructor (db: mongodb.Db) {
    super();
    this.db = db
  }

  protected getTable<T extends dbLib.TableEntity> (): mongodb.Collection<T> {
    return this.db.collection<T>(this.tableName)
  }

  protected putItem<T extends dbLib.TableEntity> (obj: T): Promise<T> {
    return new Promise((resolve, reject) => {
      let copyObj = _.cloneDeep(obj)
      copyObj['_id'] = copyObj['id'] || <string> uuid()
      delete copyObj['id']
      this.getTable<T>()
        .replaceOne({ '_id': copyObj['_id'] }, copyObj, { upsert: true })
        .then(() => resolve(copyObj))
        .catch(err => reject(err))
    })
  }

  protected async getAllItems<T extends dbLib.TableEntity> (attrNamesToGet?: (keyof T)[]): Promise<T[]> {
    let prjFields = this.composeProjectFields<T>(attrNamesToGet)
    return this.getTable<T>().find({}, prjFields).toArray().then(res => this.addBackIdField(res))
  }

  protected getItem<T extends dbLib.TableEntity, KeyType = string> (
    keyName: string, keyValue: KeyType, attrNamesToGet?: (keyof T)[]
  ): Promise<T> {
    let query = {}
    query[keyName] = keyValue
    return this.queryItemOne<T>(query, attrNamesToGet)
  }

  protected getItems<T extends dbLib.TableEntity, KeyType = string> (
    keyName: string, keyValues: KeyType[], attrNamesToGet?: (keyof T)[]
  ): Promise<T[]> {
    let prjFields = this.composeProjectFields<T>(attrNamesToGet)
    let makeQuery = (chunk) => {
      let query = {}
      query[keyName] = { $in: chunk }
      return this.getTable<T>().find(query, prjFields).toArray().then(res => this.addBackIdField(res))
    }

    let chunks = _.chunk(keyValues, MongoDBTable.AZURE_MAX_QUERY_ITEMS)
    let promises: Promise<T[]>[] = []
    _.each(chunks, chunk => promises.push(makeQuery(chunk)))
    return Promise.all(promises).then(results => _.flatten(results))
  }

  protected async queryItems<T extends dbLib.TableEntity> (query: any, attrNamesToGet?: (keyof T)[]): Promise<T[]> {
    if (_.isEmpty(query)) {
      console.log(`[MongoDBTable::queryItems()] empty query! Reutrn empty results.`)
      return Promise.resolve([])
    }

    let prjFields = this.composeProjectFields<T>(attrNamesToGet)
    let pageSize = MongoDBTable.AZURE_MAX_QUERY_ITEMS
    let runQuery = (pageId: number = 0) =>
      this.getTable<T>()
        .find(query, prjFields)
        .limit(pageSize)
        .skip(pageId * pageSize)
        .toArray()
        .then(res => this.addBackIdField(res))

    let results: T[] = []
    let pageId = 0
    while (true) {
      try {
        let batch = await runQuery(pageId)
        console.log(`[MongoDBTable::queryItems()] pageSize = ${pageSize}, pageId = ${pageId}, batch.length = ${batch.length}`)
        if (batch && batch.length > 0) {
          results = _.concat(results, batch)
          if (batch.length < pageSize) {
            break
          } else {
            ++pageId
          }
        } else {
          break
        }
      } catch (err) {
        console.log(`[MongoDBTable::queryItems()] DB Error = ${JSON.stringify(err, null, 2)}`)
        return results
      }
    }
    return results
  }

  protected queryItemOne<T extends dbLib.TableEntity> (query: any, attrNamesToGet?: (keyof T)[]): Promise<T> {
    let prjFields = this.composeProjectFields<T>(attrNamesToGet)
    return this.getTable<T>().findOne(query, prjFields).then(res => this.addBackIdField(res))
  }

  protected getItemsHavingAttributes<T extends dbLib.TableEntity> (keys: (keyof T)[], ...attrNamesToGet: (keyof T)[]): Promise<T[]> {
    let query = {}
    _.each(keys, key => query[<string> key] = { $exists: true })
    let prjFields = this.composeProjectFields<T>(attrNamesToGet)
    return this.getTable<T>().find(query, prjFields).toArray().then(res => this.addBackIdField(res))
  }

  protected getItemsNotHavingAttributes<T extends dbLib.TableEntity> (keys: (keyof T)[], ...attrNamesToGet: (keyof T)[]): Promise<T[]> {
    let query = {}
    _.each(keys, key => query[<string> key] = { $exists: false })
    let prjFields = this.composeProjectFields<T>(attrNamesToGet)
    return this.getTable<T>().find(query, prjFields).toArray().then(res => this.addBackIdField(res))
  }

  public async forEachBatch<T extends dbLib.TableEntity> (
    callback: (batch: T[]) => Promise<boolean | void>,
    attrNamesToGet?: (keyof T)[]
  ): Promise<void> {

    const pageSize = Math.min(this.suggestPageSize, MongoDBTable.AZURE_MAX_QUERY_ITEMS)
    let pageId = 0
    let prjFields = this.composeProjectFields<T>(attrNamesToGet)

    do {
      try {
        let batch = await this.getTable<T>().find({}, prjFields).skip(pageSize * pageId).limit(pageSize).toArray()
        if (!batch || _.isEmpty(batch)) {
          break;
        }
        let goNext: boolean | void = await callback(batch)
        if (typeof goNext === 'boolean') {
          goNext = <boolean> goNext
        } else {
          goNext = true
        }
        if (!goNext) {
          break
        }
      } catch (e) {
        console.log(`[MongoDBManager::forEachBatch()] Unexpected error = ${JSON.stringify(e, null, 2)}`)
        Promise.resolve()
      }
    } while (++pageId);
    return Promise.resolve()
  }

  protected updateItemByObjectId<T extends dbLib.TableEntity> (objectId: string, updateItem: EntryType<T>): Promise<mongodb.WriteOpResult> {
    let query = { $set: updateItem }
    return this.getTable<T>().update({ '_id': objectId }, query)
  }

  protected deleteItems (idx: string[]): Promise<mongodb.DeleteWriteOpResultObject> {
    return this.getTable().deleteMany({'_id': { '$in': idx}})
  }

  protected deleteAttributesFromItem<T extends dbLib.TableEntity, KeyType = string> (objectId: KeyType, attrName: (keyof T)[]): Promise<mongodb.WriteOpResult> {
    let unset = _.transform(attrName, (res, val, key) => res[ <string>val ] = '', {})
    let query = { $unset: unset }
    return this.getTable<T>().update({ '_id': objectId }, query)
  }

  protected composeProjectFields<T extends dbLib.TableEntity> (attrNamesToGet?: (keyof T)[]): MongoDBProjectQueryType {
    let r: MongoDBProjectQueryType = {}
    if (attrNamesToGet) {
      _.each(attrNamesToGet, key => r[<string> key] = 1)
    }
    if (_.includes(<string[]> attrNamesToGet, 'id')) {
      r['_id'] = 1
    }
    return r
  }

  // '_id' to 'id'
  protected addBackIdField<T> (items: T): T {
    if (!items) {
      return items
    }

    let convert = (b: any) => {
      if (b['_id']) {
        b['id'] = b['_id']
        delete b['_id']
      }
      return b
    }

    return _.isArray(items) ? _.each(items, convert) : convert(items)
  }

  protected composeQueryOfSingleOrMultipleValues<T> (key: string, val: T | T[]): any {
    let query = {}

    if (!val) {
      return query
    }

    if (_.isArray(val)) {
      if (val.length === 1 && val[0]) {
        query[key] = val[0]
      } else if (val.length > 1) {
        query[key] = { $in: val }
      }
    } else {
      query[key] = val
    }
    return query
  }
}
