import * as aws from 'aws-sdk'
import * as awsConfig from '../../config/aws.json'
import { PersonEntity, TableEntity, Table } from './DbLib'
import * as _ from 'lodash'

// RoleTable

export type SponsorType = 'sponsor' | 'cosponsor'

export interface RoleEntity extends TableEntity {
  id: string
  person: PersonEntity

  createdAt?: number // UTC time
  lastUpdatedAt?: number // UTC time

  startDate?: number // UTC time
  endDate?: number // UTC time
  congressNumbers?: number[]

  title?: string
  titleLong?: string
  roleType?: string
  roleTypeDisplay?: string
  office?: string
  phone?: string
  party?: string
  caucus?: string
  state?: string
  district?: number
  description?: string
  leadershipTitle?: string
  senatorClass?: string
  senatorClassDisplay?: string
  senatorRank?: string
  senatorRankDisplay?: string
  website?: string

  // bill index sponsor / co-sponsor
  billIdSponsored?: string[]
  billIdCosponsored?: string[]
}

export class RoleTable extends Table {
  public readonly tableName = (<any> awsConfig).dynamodb.VOLUNTEER_ROLES_TABLE_NAME

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

  public getRolesById (idx: string[], ...attrNamesToGet: (keyof RoleEntity)[]): Promise<RoleEntity[]> {
    return super.getItems<RoleEntity>('id', idx, attrNamesToGet).then(data =>
      (data && data.Responses && data.Responses[this.tableName]) ?
        _.map(data.Responses[this.tableName], (r: any) => this.convertAttrMapToBillRoleEntity(r)) : null)
  }

  public getRolesByCongress (congress: number, ...attrNamesToGet: (keyof RoleEntity)[]): Promise<RoleEntity[]> {
    const filterExp = `contains( congressNumbers, :v_congress )`
    const expAttrVals: aws.DynamoDB.DocumentClient.ExpressionAttributeValueMap = {
      ':v_congress': congress,
    }
    return super.scanItems<RoleEntity>({filterExp, expAttrVals, attrNamesToGet, flushOut: true}).then(out =>
      _.map(out.results, (r: any) => this.convertAttrMapToBillRoleEntity(r)))
  }

  public getRolesHavingSponsoredBills (type: SponsorType): Promise<RoleEntity[]> {
    let attrName: (keyof RoleEntity) = (type === 'sponsor') ? 'billIdSponsored' : 'billIdCosponsored'
    return super.getItemsHavingAttributes<RoleEntity>([attrName]).then(out =>
      _.map(out, (r: any) => this.convertAttrMapToBillRoleEntity(r)))
  }

  public setBillIdArrayToRole (id: string, billIdx: string[], type: SponsorType): Promise<aws.DynamoDB.UpdateItemOutput> {
    const params: aws.DynamoDB.UpdateItemInput = {
      TableName: this.tableName,
      Key: { 'id': {'S': id} },
      UpdateExpression: `SET #k_billId = :v_billId`,
      ExpressionAttributeNames: { '#k_billId': type === 'sponsor' ? 'billIdSponsored' : 'billIdCosponsored' },
      ExpressionAttributeValues: { ':v_billId': {'SS': billIdx} }
    }

    return new Promise((resolve, reject) => {
      this.db.updateItem(params, (err, data) => err ? reject(err) : resolve(data))
    })
  }

  public addBillToRole (id: string, billId: string, type: SponsorType): Promise<aws.DynamoDB.UpdateItemOutput> {
    const params: aws.DynamoDB.UpdateItemInput = {
      TableName: this.tableName,
      Key: { 'id': {'S': id} },
      UpdateExpression: `ADD #k_billId :v_billId`,
      ExpressionAttributeNames: { '#k_billId': type === 'sponsor' ? 'billIdSponsored' : 'billIdCosponsored' },
      ExpressionAttributeValues: { ':v_billId': {'SS': [billId]} }
    }

    return new Promise((resolve, reject) => {
      this.db.updateItem(params, (err, data) => err ? reject(err) : resolve(data))
    })
  }

  public removeBillFromRole (id: string, billId: string, type: SponsorType): Promise<aws.DynamoDB.UpdateItemOutput>  {
    const params: aws.DynamoDB.UpdateItemInput = {
      TableName: this.tableName,
      Key: { 'id': {'S': id} },
      UpdateExpression: `DELETE #k_billId :v_billId`,
      ExpressionAttributeNames: { '#k_billId': type === 'sponsor' ? 'billIdSponsored' : 'billIdCosponsored' },
      ExpressionAttributeValues: { ':v_billId': {'SS': [billId]} }
    }

    return new Promise((resolve, reject) => {
      this.db.updateItem(params, (err, data) => err ? reject(err) : resolve(data))
    })
  }

  public removeAllBillsFromRole (id: string, type?: SponsorType): Promise<aws.DynamoDB.DocumentClient.UpdateItemOutput>  {
    let attrName: (keyof RoleEntity)[] = ['billIdSponsored', 'billIdCosponsored']
    if (type) {
      (type === 'sponsor') ? attrName = ['billIdSponsored'] : attrName['billIdCosponsored']
    }
    return super.deleteAttributesFromItem<RoleEntity>('id', id, attrName)
  }

  private convertAttrMapToBillRoleEntity (item: aws.DynamoDB.AttributeMap): RoleEntity {
    if (item && item.billIdSponsored) {
      item.billIdSponsored = item.billIdSponsored['values'] || []
    }
    if (item && item.billIdCosponsored) {
      item.billIdCosponsored = item.billIdCosponsored['values'] || []
    }
    return <any> item
  }
}
