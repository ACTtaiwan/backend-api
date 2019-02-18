import * as aws from 'aws-sdk';
import { DynamoDBTable, TableEntity, QueryInput } from './';
import { ChamberType } from '../congressGov/CongressGovModels';

var awsConfig = require('../../config/aws.json');

// BillTypeTable

export type BillVersionChamberType = ChamberType | 'joint';

export interface BillVersionEntity extends TableEntity {
  id: string;
  code: string;
  name: string;
  chamber: BillVersionChamberType[];
  description: string;
}

export class BillVersionTable extends DynamoDBTable {
  public readonly tableName = (<any> awsConfig).dynamodb.VOLUNTEER_BILLVERSIONS_TABLE_NAME;

  constructor (db: aws.DynamoDB.DocumentClient) {
    super(db);
  }

  public get tableDefinition (): [aws.DynamoDB.KeySchema, aws.DynamoDB.AttributeDefinitions] {
    const keySchema: aws.DynamoDB.KeySchema = [
      { AttributeName: 'id', KeyType: 'HASH'}
    ];
    const attrDef: aws.DynamoDB.AttributeDefinitions = [
      { AttributeName: 'id', AttributeType: 'S' }
    ];
    return [keySchema, attrDef];
  }

  public putVersion (obj: BillVersionEntity): Promise<aws.DynamoDB.DocumentClient.PutItemOutput> {
    return super.putItem(obj);
  }

  public getAllVersions (): Promise<BillVersionEntity[]> {
    return super.getAllItems<BillVersionEntity>().then(out => out.results);
  }

  public getVersionById (id: string): Promise<BillVersionEntity> {
    return super.getItem('id', id).then(data =>
      (data && data.Item) ? <BillVersionEntity> data.Item : null);
  }

  public getVersionByCode (code: string): Promise<BillVersionEntity> {
    let input: QueryInput<BillVersionEntity> = {
      indexName: 'code-index',
      keyExp: `#k_code = :v_code`,
      expAttrNames: {'#k_code': 'code'},
      expAttrVals: {':v_code': code},
      flushOut: true
    };
    return super.queryItem<BillVersionEntity>(input).then(out => out.results && out.results[0]);
  }

  public updateVersion (id: string, update: BillVersionEntity)
  : Promise<aws.DynamoDB.DocumentClient.UpdateItemOutput> {
    return super.updateItem<BillVersionEntity>('id', id, update);
  }
}
