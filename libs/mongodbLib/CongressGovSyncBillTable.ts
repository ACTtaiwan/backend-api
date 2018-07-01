import * as mongodb from 'mongodb'
import * as dbLib from '../dbLib'
import { MongoDBTable } from './'
import { MongoDbConfig } from '../../config/mongodb'

export class CongressGovSyncBillTable extends MongoDBTable<dbLib.BillEntityHydrateField> {
  public readonly tableName = MongoDbConfig.tableNames.CONGRESSGOV_SYNC_BILL_TABLE_NAME
  protected readonly suggestPageSize: number = 10

  constructor (db: mongodb.Db) {
    super(db)
  }
  public putObject (obj: dbLib.CongressGovSyncBillEntity): Promise<dbLib.CongressGovSyncBillEntity> {
    obj.lastUpdate = new Date().getTime()
    return super.getTable<dbLib.CongressGovSyncBillEntity>().update(
        { urlPath: obj.urlPath },
        { $set: obj },
        { upsert: true }
      ).then(() => obj)
  }

  public getAllObjects (...attrNamesToGet: (keyof dbLib.CongressGovSyncBillEntity)[]): Promise<dbLib.CongressGovSyncBillEntity[]> {
    return super.getAllItems<dbLib.CongressGovSyncBillEntity>(attrNamesToGet)
  }

  public getObjectByUrlPath (urlPath: string): Promise<dbLib.CongressGovSyncBillEntity> {
    return super.queryItemOne<dbLib.CongressGovSyncBillEntity>({urlPath})
  }
}
