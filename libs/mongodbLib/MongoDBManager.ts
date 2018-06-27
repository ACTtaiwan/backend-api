import * as mongodb from 'mongodb';
import * as _ from 'lodash';
import { MongoDbConfig } from '../../config/mongodb';
import * as dbLib from '../dbLib';
import { BillCategoryTable } from './';

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
      return new Promise<void>((resolve, reject) => {
        MongoDbConfig.remoteUrl.then(dbUrl => {
          console.log(`[MongoDBManager] URL = ${dbUrl}`);
          mongodb.connect(dbUrl, (err, db) => {
            if (err) {
              console.log(`[MongoDBManager] DB connect error = ${JSON.stringify(err, null, 2)}`)
              reject(err);
            } else {
              console.log(`[MongoDBManager] DB connected`)
              this.db = db;
              const tables = <MongoDBTable[]> [
                new BillCategoryTable(this.db),
              ]
              this.tables = _.keyBy(tables, x => x.tableName)
              resolve();
            }
          });
        });
      });
    }
  }
}

export type MongoDBProjectQueryType = {[key: string]: 1}

export type EntryType<T extends dbLib.TableEntity> = {[key in (keyof T)]?: T[key] | number | string}

export abstract class MongoDBTable<HydrateField = string> extends dbLib.Table<HydrateField> {
  protected db: mongodb.Db;

  constructor (db: mongodb.Db) {
    super();
    this.db = db
  }

  protected getTable<T extends dbLib.TableEntity> (): mongodb.Collection<T> {
    return this.db.collection<T>(this.tableName)
  }

  protected async getAllItems<T extends dbLib.TableEntity> (attrNamesToGet?: (keyof T)[]): Promise<T[]> {
    return new Promise<T[]>((resolve, reject) => {
      let prjFields = this.composeProjectFields<T>(attrNamesToGet)
      this.getTable<T>().find({}, prjFields).toArray((err, results) => err ? reject(err) : resolve(results))
    })
  }

  protected getItems<T extends dbLib.TableEntity, KeyType = string> (
    keyName: string, keyValues: KeyType[], attrNamesToGet?: (keyof T)[]
  ): Promise<T[]> {
    return new Promise<T[]>((resolve, reject) => {
      let query = {}
      query[keyName] = { $in: keyValues }
      let prjFields = this.composeProjectFields<T>(attrNamesToGet)
      this.getTable<T>().find(query, prjFields).toArray((err, results) => err ? reject(err) : resolve(results))
    })
  }

  protected updateItemByObjectId<T extends dbLib.TableEntity> (objectId: string, updateItem: T): Promise<mongodb.WriteOpResult> {
    let query = { $set: updateItem }
    return this.getTable<T>().update({ '_id': objectId }, query)
  }

  protected deleteAttributesFromItem<T extends dbLib.TableEntity, KeyType = string> (objectId: KeyType, attrName: (keyof T)[]): Promise<mongodb.WriteOpResult> {
    let unset = _.transform(attrName, (res, val, key) => res[ <string>val ] = '', {})
    let query = { $unset: unset }
    return this.getTable<T>().update({ '_id': objectId }, query)
  }

  private composeProjectFields<T extends dbLib.TableEntity> (attrNamesToGet?: (keyof T)[]): MongoDBProjectQueryType {
    let r: MongoDBProjectQueryType = {}
    if (attrNamesToGet) {
      _.each(attrNamesToGet, key => r[<string> key] = 1)
    }
    return r
  }
}
