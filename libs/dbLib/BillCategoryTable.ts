import * as aws from 'aws-sdk'
import * as awsConfig from '../../config/aws.json'
import {TableEntity, Table} from './DbLib'
import * as _ from 'lodash'

// CategoryTable

export interface BillCategoryEntity extends TableEntity {
  id: string
  code: string
  name: string
  name_zh?: string
  description?: string
  description_zh?: string
  billId?: string[]
}

export class BillCategoryTable extends Table {
  public readonly tableName = (<any> awsConfig).dynamodb.VOLUNTEER_BILLCATEGORIES_TABLE_NAME

  constructor (docClient: aws.DynamoDB.DocumentClient, db: aws.DynamoDB) {
    super(docClient, db)
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

  public getAllCategories (): Promise<BillCategoryEntity[]> {
    return super.getAllItems<BillCategoryEntity>(['id', 'code', 'name', 'name_zh', 'description', 'description_zh'])
      .then(out => _.map(out.results, (r: any) => this.convertAttrMapToBillCategoryEntity(r)) || [] )
  }

  public getCategoriesById (idx: string[], ...attrNamesToGet: (keyof BillCategoryEntity)[]): Promise<BillCategoryEntity[]> {
    return super.getItems<BillCategoryEntity>('id', idx, attrNamesToGet).then(data =>
      (data && data.Responses && data.Responses[this.tableName]) ?
        _.map(data.Responses[this.tableName], (r: any) => this.convertAttrMapToBillCategoryEntity(r)) : null)
  }

  public setBillIdArrayToCategory (catId: string, billIdx: string[]): Promise<aws.DynamoDB.UpdateItemOutput> {
    const params: aws.DynamoDB.UpdateItemInput = {
      TableName: this.tableName,
      Key: { 'id': {'S': catId} },
      UpdateExpression: `SET billId = :v_billId`,
      ExpressionAttributeValues: { ':v_billId': {'SS': billIdx} }
    }

    return new Promise((resolve, reject) => {
      this.db.updateItem(params, (err, data) => err ? reject(err) : resolve(data))
    })
  }

  public addBillToCategory (catId: string, billId: string): Promise<aws.DynamoDB.UpdateItemOutput> {
    const params: aws.DynamoDB.UpdateItemInput = {
      TableName: this.tableName,
      Key: { 'id': {'S': catId} },
      UpdateExpression: `ADD billId :v_billId`,
      ExpressionAttributeValues: { ':v_billId': {'SS': [billId]} }
    }

    return new Promise((resolve, reject) => {
      this.db.updateItem(params, (err, data) => err ? reject(err) : resolve(data))
    })
  }

  public removeBillFromCategory (catId: string, billId: string): Promise<aws.DynamoDB.UpdateItemOutput>  {
    const params: aws.DynamoDB.UpdateItemInput = {
      TableName: this.tableName,
      Key: { 'id': {'S': catId} },
      UpdateExpression: `DELETE billId :v_billId`,
      ExpressionAttributeValues: { ':v_billId': {'SS': [billId]} }
    }

    return new Promise((resolve, reject) => {
      this.db.updateItem(params, (err, data) => err ? reject(err) : resolve(data))
    })
  }

  public removeAllBillsFromCategory (catId: string): Promise<aws.DynamoDB.DocumentClient.UpdateItemOutput>  {
    return super.deleteAttributesFromItem<BillCategoryEntity>('id', catId, ['billId'])
  }

  private convertAttrMapToBillCategoryEntity (item: aws.DynamoDB.AttributeMap): BillCategoryEntity {
    if (item && item.billId) {
      item.billId = item.billId['values'] || []
      return <any> item
    }
    return <any> item
  }
}
