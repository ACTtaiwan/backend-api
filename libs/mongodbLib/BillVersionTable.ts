import * as mongodb from 'mongodb';
import { MongoDBTable } from './';
import { MongoDbConfig } from '../../config/mongodb';
import * as dbLib from '../dbLib';

export class BillVersionTable extends MongoDBTable {
  public readonly tableName = MongoDbConfig.tableNames.BILLVERSIONS_TABLE_NAME;
  protected readonly suggestPageSize: number = 1000;

  public putVersion (obj: dbLib.BillVersionEntity): Promise<dbLib.BillVersionEntity> {
    return super.putItem(obj);
  }

  public getAllVersions (): Promise<dbLib.BillVersionEntity[]> {
    return super.getAllItems<dbLib.BillVersionEntity>();
  }

  public getVersionById (id: string): Promise<dbLib.BillVersionEntity> {
    return super.getItem<dbLib.BillVersionEntity>('_id', id);
  }

  public getVersionByCode (code: string): Promise<dbLib.BillVersionEntity> {
    return super.getItem<dbLib.BillVersionEntity>('code', code);
  }

  public updateVersion (id: string, item: dbLib.BillVersionEntity): Promise<mongodb.WriteOpResult> {
    return super.updateItemByObjectId<dbLib.BillVersionEntity>(id, item);
  }
}
