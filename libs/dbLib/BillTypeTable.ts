import * as aws from 'aws-sdk'
import * as models from '../congressGov/CongressGovModels'
import { DynamoDBTable, TableEntity, BillEntity } from './'

var awsConfig = require('../../config/aws.json');

// BillTypeTable

export interface BillTypeEntity extends TableEntity {
  id: string
  chamber: models.ChamberType
  code: models.BillTypeCode
  display: string
  name: string
}

export class BillTypeTable extends DynamoDBTable {
  public readonly tableName = (<any> awsConfig).dynamodb.VOLUNTEER_BILLTYPES_TABLE_NAME

  constructor (db: aws.DynamoDB.DocumentClient) {
    super(db)
  }

  public get tableDefinition (): [aws.DynamoDB.KeySchema, aws.DynamoDB.AttributeDefinitions] {
    const keySchema: aws.DynamoDB.KeySchema = [
      { AttributeName: 'id', KeyType: 'HASH'}
    ]
    const attrDef: aws.DynamoDB.AttributeDefinitions = [
      { AttributeName: 'id', AttributeType: 'S' }
    ]
    return [keySchema, attrDef]
  }

  public putType (obj: BillTypeEntity): Promise<aws.DynamoDB.DocumentClient.PutItemOutput> {
    return super.putItem(obj)
  }

  public getAllTypes (): Promise<BillTypeEntity[]> {
    return super.getAllItems<BillTypeEntity>().then(out => out.results)
  }

  public getTypeById (id: string): Promise<BillTypeEntity> {
    return super.getItem('id', id).then(data =>
      (data && data.Item) ? <BillTypeEntity> data.Item : null)
  }

  public getTypesByField (key: keyof BillEntity, val: any): Promise<BillTypeEntity[]> {
    const filterExp = `#k_key = :v_val`
    const expAttrNames: aws.DynamoDB.DocumentClient.ExpressionAttributeNameMap = {
      '#k_key': key,
    }
    const expAttrVals: aws.DynamoDB.DocumentClient.ExpressionAttributeValueMap = {
      ':v_val': val,
    }
    return super.scanItems<BillTypeEntity>({filterExp, expAttrNames, expAttrVals, flushOut: true}).then(out => out.results)
  }
}
