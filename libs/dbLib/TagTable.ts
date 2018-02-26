import * as aws from 'aws-sdk'
import * as awsConfig from '../../config/aws.json'
import * as models from '../congressGov/CongressGovModels'
import * as _ from 'lodash'

import {TableEntity, Table, QueryInput, ScanInput, ScanOutput, DynamoDBManager} from './'

// TagMetaTable

export interface TagMetaEntity extends TableEntity {
  id: string
  typeCode: string
  typeDisplay: string
}

export class TagMetaTable extends Table {
  public readonly tableName = (<any> awsConfig).dynamodb.VOLUNTEER_TAGS_META_TABLE_NAME

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

  public putMetaInfo (obj: TagMetaEntity): Promise<aws.DynamoDB.DocumentClient.PutItemOutput> {
    return super.putItem(obj)
  }

  public updateMetaInfo (id: string, updateMeta: TagMetaEntity)
  : Promise<aws.DynamoDB.DocumentClient.UpdateItemOutput> {
    return super.updateItem<TagMetaEntity>('id', id, updateMeta)
  }

  public getAllMetaInfo (): Promise<TagMetaEntity[]> {
    return super.getAllItems<TagMetaEntity>().then(out => out.results)
  }

  public deleteMetaInfo (idx: string[]): Promise<aws.DynamoDB.BatchWriteItemOutput> {
    return (idx && idx.length > 0) ? super.deleteItems('id', idx) : Promise.resolve({})
  }
}

// TagTable

export interface TagEntity extends TableEntity {
  tag?: string // id - primary partition key
  billId?: string[]
  meta?: TagMetaEntity
  totalUserCount?: number
}

export class TagTable extends Table {
  public readonly tableName = (<any> awsConfig).dynamodb.VOLUNTEER_TAGS_TABLE_NAME

  constructor (docClient: aws.DynamoDB.DocumentClient, db: aws.DynamoDB) {
    super(docClient, db)
  }

  public get tableDefinition (): [aws.DynamoDB.KeySchema, aws.DynamoDB.AttributeDefinitions] {
    const keySchema: aws.DynamoDB.KeySchema = [
      { AttributeName: 'tag', KeyType: 'HASH'}
    ]
    const attrDef: aws.DynamoDB.AttributeDefinitions = [
      { AttributeName: 'tag', AttributeType: 'S' }
    ]
    return [keySchema, attrDef]
  }

  public putTag (obj: TagEntity): Promise<aws.DynamoDB.PutItemOutput> {
    let params: aws.DynamoDB.PutItemInput = {
      TableName: this.tableName,
      Item: this.entityToAttrMap(obj)
    }

    return new Promise((resolve, reject) => {
      this.db.putItem(params, (err, data) => err ? reject(err) : resolve(data))
    })
  }

  public getTag (tag: string, ...attrNamesToGet: (keyof TagEntity)[]): Promise<TagEntity> {
    return super.getItem<TagEntity>('tag', tag, attrNamesToGet).then(data =>
      (data && data.Item) ? this.convertAttrMapToTagEntity(data.Item) : null
    )
  }

  public getTags (tags: string[], ...attrNamesToGet: (keyof TagEntity)[]): Promise<TagEntity[]> {
    return super.getItems<TagEntity>('tag', tags, attrNamesToGet).then(
      data => _.map(data, (r: any) => this.convertAttrMapToTagEntity(r)))
  }

  public getAllTags (...attrNamesToGet: (keyof TagEntity)[]): Promise<TagEntity[]> {
    return super.getAllItems<TagEntity>(attrNamesToGet).then(out =>
      _.map(out.results, (r: any) => this.convertAttrMapToTagEntity(r)) || []
    )
  }

  public queryTags (
    q: string,
    attrNamesToGet?: (keyof TagEntity)[],
    maxSearchItems?: number,
    op: 'contains' | 'begins_with' = 'begins_with'
  ): Promise<TagEntity[]> {
    let input: ScanInput<TagEntity> = {
      filterExp: `${op} (tag, :v_q)`,
      expAttrVals: {':v_q': q},
      flushOut: true,
      maxItems: maxSearchItems,
      attrNamesToGet
    }
    return super.scanItems<TagEntity>(input).then(out =>
       _.map(out.results, (r: any) => this.convertAttrMapToTagEntity(r)) || [])
  }

  public updateTotalUserCount (tag: string, totalUserCount: number): Promise<aws.DynamoDB.DocumentClient.UpdateItemOutput> {
    return super.updateItem('tag', tag, {totalUserCount})
  }

  public setBillIdArrayToTag (tag: string, billIdx: string[]): Promise<aws.DynamoDB.UpdateItemOutput> {
    billIdx = _.uniq(billIdx)
    const params: aws.DynamoDB.UpdateItemInput = {
      TableName: this.tableName,
      Key: { 'tag': {'S': tag} },
      UpdateExpression: `SET billId = :v_billId`,
      ExpressionAttributeValues: { ':v_billId': {'SS': billIdx} }
    }

    return new Promise((resolve, reject) => {
      this.db.updateItem(params, (err, data) => err ? reject(err) : resolve(data))
    })
  }

  public addBillToTag (tag: string, billId: string): Promise<aws.DynamoDB.UpdateItemOutput> {
    const params: aws.DynamoDB.UpdateItemInput = {
      TableName: this.tableName,
      Key: { 'tag': {'S': tag} },
      UpdateExpression: `ADD billId :v_billId`,
      ExpressionAttributeValues: { ':v_billId': {'SS': [billId]} }
    }

    return new Promise((resolve, reject) => {
      this.db.updateItem(params, (err, data) => err ? reject(err) : resolve(data))
    })
  }

  public removeBillFromTag (tag: string, billId: string) {
    const params: aws.DynamoDB.UpdateItemInput = {
      TableName: this.tableName,
      Key: { 'tag': {'S': tag} },
      UpdateExpression: `DELETE billId :v_billId`,
      ExpressionAttributeValues: { ':v_billId': {'SS': [billId]} }
    }

    return new Promise((resolve, reject) => {
      this.db.updateItem(params, (err, data) => err ? reject(err) : resolve(data))
    })
  }

  public deleteTag (tag: string): Promise<aws.DynamoDB.DocumentClient.DeleteItemOutput> {
    return tag ? super.deleteItem('tag', tag) : Promise.resolve({})
  }

  public deleteTags (tags: string[]): Promise<aws.DynamoDB.DocumentClient.BatchWriteItemOutput> {
    return (tags && tags.length > 0) ? super.deleteItems('tag', tags) : Promise.resolve({})
  }

  private entityToAttrMap (obj: TagEntity): aws.DynamoDB.MapAttributeValue {
    const m = this.objectToAttrMap(obj)
    if (obj.billId) {
      delete m.billId
      m.billId = {'SS': _.uniq(obj.billId)}
    }
    return m
  }

  private objectToAttrMap (obj: {[key: string]: any}): aws.DynamoDB.MapAttributeValue {
    let parseSingleValue = (val: any): aws.DynamoDB.AttributeValue => {
      if (typeof val === 'string') {
        return {'S': val}
      } else if (typeof val === 'boolean') {
        return {'BOOL': val}
      } else if (typeof val === 'number') {
        return {'N': val.toString()}
      }
    }

    let attrMap: aws.DynamoDB.MapAttributeValue = {}
    _.each(obj, (val, key) => {
      if (typeof val === 'string' || typeof val === 'boolean' || typeof val === 'number') {
        attrMap[key] = parseSingleValue(val)
      } else if (val instanceof Array) {
        const arr = _.map(val, x => parseSingleValue(x))
        attrMap[key] = {'L': arr}
      } else if (typeof val === 'object') {
        attrMap[key] = {'M': this.objectToAttrMap(val)}
      }
    })
    return attrMap
  }

  private convertAttrMapToTagEntity (item: aws.DynamoDB.AttributeMap): TagEntity {
    if (item && item.billId) {
      item.billId = item.billId['values'] || []
      return <TagEntity> item
    }
    return item
  }
}
