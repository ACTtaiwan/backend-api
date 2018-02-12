import * as aws from 'aws-sdk'
import * as awsConfig from '../../config/aws.json'
import { Table, TableEntity } from './DbLib'

// CongressGovSyncBillTable

export interface CongressGovSyncBillEntity extends TableEntity {
  urlPath: string
  rawData: string
  lastUpdate?: number
}

export class CongressGovSyncBillTable extends Table {
  public readonly tableName = (<any> awsConfig).dynamodb.CONGRESSGOV_SYNC_BILL_TABLE_NAME

  constructor (db: aws.DynamoDB.DocumentClient) {
    super(db)
  }

  public get tableDefinition (): [aws.DynamoDB.KeySchema, aws.DynamoDB.AttributeDefinitions] {
    const keySchema: aws.DynamoDB.KeySchema = [
      { AttributeName: 'urlPath', KeyType: 'HASH'}
    ]
    const attrDef: aws.DynamoDB.AttributeDefinitions = [
      { AttributeName: 'urlPath', AttributeType: 'S' }
    ]
    return [keySchema, attrDef]
  }

  public putObject (obj: CongressGovSyncBillEntity): Promise<aws.DynamoDB.DocumentClient.PutItemOutput> {
    obj.lastUpdate = new Date().getTime()
    return super.putItem(obj)
  }

  public getAllObjects (...attrNamesToGet: (keyof CongressGovSyncBillEntity)[]): Promise<CongressGovSyncBillEntity[]> {
    return super.getAllItems<CongressGovSyncBillEntity>(attrNamesToGet).then(out => out.results)
  }

  public getObjectByUrlPath (url: string): Promise<CongressGovSyncBillEntity> {
    return super.getItem('urlPath', url).then(data =>
      (data && data.Item) ? <CongressGovSyncBillEntity> data.Item : null)
  }
}
