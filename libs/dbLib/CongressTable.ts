import * as aws from 'aws-sdk'
import { TableEntity, Table } from './'
import * as _ from 'lodash'

var awsConfig = require('../../config/aws.json');

// CongressTable

export interface CongressEntity extends TableEntity {
  congress?: number
  roleId?: string[]
}

export class CongressTable extends Table {
  public readonly tableName = (<any> awsConfig).dynamodb.VOLUNTEER_CONGRESS_TABLE_NAME

  constructor (docClient: aws.DynamoDB.DocumentClient, db: aws.DynamoDB) {
    super(docClient, db)
  }

  public get tableDefinition (): [aws.DynamoDB.KeySchema, aws.DynamoDB.AttributeDefinitions] {
    const keySchema: aws.DynamoDB.KeySchema = [
      { AttributeName: 'congress', KeyType: 'HASH'}
    ]
    const attrDef: aws.DynamoDB.AttributeDefinitions = [
      { AttributeName: 'congress', AttributeType: 'N' }
    ]
    return [keySchema, attrDef]
  }

  public getCongressEntity (congress: number, ...attrNamesToGet: (keyof CongressEntity)[]): Promise<CongressEntity> {
    return super.getItem<CongressEntity, number>('congress', congress, attrNamesToGet).then(
      data => data ? this.convertAttrMapToCongressEntity(data.Item) : null)
  }

  public getCongressEntities (congress: number[], ...attrNamesToGet: (keyof CongressEntity)[]): Promise<CongressEntity[]> {
    return super.getItems<CongressEntity, number>('congress', congress, attrNamesToGet).then(
      items => _.map(items, (r: any) => this.convertAttrMapToCongressEntity(r)))
  }

  public getRoleIdxByCongress (congress: number): Promise<string[]> {
    return this.getCongressEntity(congress, 'roleId').then(out => out.roleId)
  }

  public setRoleIdArrayToCongress (congress: number, roleId: string[]): Promise<aws.DynamoDB.UpdateItemOutput> {
    roleId = _.uniq(roleId)
    const params: aws.DynamoDB.UpdateItemInput = {
      TableName: this.tableName,
      Key: { 'congress': {'N': congress.toString()} },
      UpdateExpression: `SET #k_key = :v_key`,
      ExpressionAttributeNames: { '#k_key': 'roleId' },
      ExpressionAttributeValues: { ':v_key': {'SS': roleId} }
    }

    return new Promise((resolve, reject) => {
      this.db.updateItem(params, (err, data) => err ? reject(err) : resolve(data))
    })
  }

  public addRoleIdArrayToCongress (congress: number, roleId: string[]): Promise<aws.DynamoDB.UpdateItemOutput> {
    roleId = _.uniq(roleId)
    const params: aws.DynamoDB.UpdateItemInput = {
      TableName: this.tableName,
      Key: { 'congress': {'N': congress.toString()} },
      UpdateExpression: `ADD #k_key :v_key`,
      ExpressionAttributeNames: { '#k_key': 'roleId' },
      ExpressionAttributeValues: { ':v_key': {'SS': roleId} }
    }

    return new Promise((resolve, reject) => {
      this.db.updateItem(params, (err, data) => err ? reject(err) : resolve(data))
    })
  }

  public removeRoleFromCongress (congress: number, roleId: string): Promise<aws.DynamoDB.UpdateItemOutput>  {
    const params: aws.DynamoDB.UpdateItemInput = {
      TableName: this.tableName,
      Key: { 'congress': {'N': congress.toString()} },
      UpdateExpression: `DELETE #k_key :v_key`,
      ExpressionAttributeNames: { '#k_key': 'roleId' },
      ExpressionAttributeValues: { ':v_key': {'SS': [roleId]} }
    }

    return new Promise((resolve, reject) => {
      this.db.updateItem(params, (err, data) => err ? reject(err) : resolve(data))
    })
  }

  public removeAllRolesFromCongress (congress: number): Promise<aws.DynamoDB.DocumentClient.UpdateItemOutput>  {
    return this.deleteAttributesFromCongress(congress, 'roleId')
  }

  public deleteAttributesFromCongress (congress: number, ...attrName: (keyof CongressEntity)[])
  : Promise<aws.DynamoDB.DocumentClient.UpdateItemOutput> {
    return super.deleteAttributesFromItem<CongressEntity, number>('congress', congress, attrName)
  }

  private convertAttrMapToCongressEntity (item: aws.DynamoDB.AttributeMap): CongressEntity {
    if (item && item.roleId) {
      item.roleId = item.roleId['values'] || []
    }
    return <any> item
  }
}
