import { MongoDBTable } from './';
import { MongoDbConfig } from '../../config/mongodb';
import * as dbLib from '../dbLib';

export class BillTypeTable extends MongoDBTable {
  public readonly tableName = MongoDbConfig.tableNames.BILLTYPES_TABLE_NAME;
  protected readonly suggestPageSize: number = 1000;

  public putType (obj: dbLib.BillTypeEntity): Promise<dbLib.BillTypeEntity> {
    return super.putItem(obj);
  }

  public getAllTypes (): Promise<dbLib.BillTypeEntity[]> {
    return super.getAllItems<dbLib.BillTypeEntity>();
  }

  public getTypeById (id: string): Promise<dbLib.BillTypeEntity> {
    return super.getItem<dbLib.BillTypeEntity>('_id', id);
  }

  public getTypesByField (key: keyof dbLib.BillEntity, val: any): Promise<dbLib.BillTypeEntity[]> {
    return super.queryItems<dbLib.BillTypeEntity>({ key: val });
  }
}
