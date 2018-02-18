import * as aws from 'aws-sdk'
import * as awsConfig from '../../config/aws.json'
import * as models from '../congressGov/CongressGovModels'
import {TableEntity, BillCategoryEntity, BillTypeEntity, BillVersionEntity, RoleEntity, Table, ScanInput, QueryInput} from './DbLib'
import { BillTextContentType } from '../s3Lib';

// BillTable

export interface S3BillDocument {
  s3Entity: string
  contentType?: BillTextContentType
}

export interface BillTextDocument extends BillVersionEntity {
  date?: number // UTC time
  documents?: S3BillDocument[]
}

export interface CosponsorEntity {
  dateCosponsored?: number
  role: RoleEntity
}

export interface BillEntity extends TableEntity {
  id: string
  congress: number
  billNumber: number
  billType?: BillTypeEntity

  // basic info
  title: string
  title_zh?: string
  introducedDate: number // UTC time
  trackers?: models.Tracker[]
  currentChamber?: models.ChamberType

  // sponsor & co-sponsor
  sponsor?: RoleEntity
  cosponsors?: CosponsorEntity[]

  // Taiwan Watch fields
  categories?: BillCategoryEntity[]
  tags?: {[tag: string]: {[userId: string]: number}}
  relevence?: number,
  china?: string,
  insight?: string,
  comment?: string

  // Congress.gov all-info
  detailTitles?: models.CongressGovTitleInfo
  actions?: models.CongressGovAction[]
  actionsAll?: models.CongressGovAction[]
  committees?: models.CongressGovCommitteeActivity[]
  relatedBills?: (models.CongressGovBill & {id?: string})[]
  subjects?: string[]
  s3Entity?: string // static content stored in S3

  // full text
  versions?: BillTextDocument[]
}

export interface BillScanOutput {
  results: BillEntity[]
  lastKey?: string
}

export class BillTable extends Table {
  public readonly tableName = (<any> awsConfig).dynamodb.VOLUNTEER_BILLS_TABLE_NAME

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

  public putBill (obj: BillEntity): Promise<aws.DynamoDB.DocumentClient.PutItemOutput> {
    return super.putItem(obj)
  }

  public createEmptyTagsAttrForBill (tag: string, billId: string)
  : Promise<aws.DynamoDB.DocumentClient.UpdateItemOutput> {
    const params: aws.DynamoDB.DocumentClient.UpdateItemInput = {
      TableName: this.tableName,
      Key: { 'id': billId },
      UpdateExpression: `SET #k_tags = :v_tags`,
      ExpressionAttributeNames: {
        '#k_tags': 'tags',
      },
      ExpressionAttributeValues: {':v_tags': {}}
    }
    return new Promise((resolve, reject) => {
      this.docClient.update(params, (err, data) => err ? reject(err) : resolve(data))
    })
  }

  public addTagToBill (tag: string, billId: string, userCount: {[userId: string]: number} = {})
  : Promise<aws.DynamoDB.DocumentClient.UpdateItemOutput> {
    const params: aws.DynamoDB.DocumentClient.UpdateItemInput = {
      TableName: this.tableName,
      Key: { 'id': billId },
      UpdateExpression: `SET #k_tags.#k_tag = :v_userCount`,
      ExpressionAttributeNames: {
        '#k_tags': 'tags',
        '#k_tag': tag
      },
      ExpressionAttributeValues: {':v_userCount': userCount}
    }
    return new Promise((resolve, reject) => {
      this.docClient.update(params, (err, data) => err ? reject(err) : resolve(data))
    })
  }

  public getBillById (id: string, ...attrNamesToGet: (keyof BillEntity)[]): Promise<BillEntity> {
    return super.getItem<BillEntity>('id', id, attrNamesToGet).then(data =>
      (data && data.Item) ? <BillEntity> data.Item : null)
  }

  public getBillsById (idx: string[], ...attrNamesToGet: (keyof BillEntity)[]): Promise<BillEntity[]> {
    return super.getItems<BillEntity>('id', idx, attrNamesToGet).then(data =>
      (data && data.Responses && data.Responses[this.tableName]) ? <BillEntity[]> data.Responses[this.tableName] : null)
  }

  public getBill (congress: number, billTypeCode: models.BillTypeCode, billNumber: number, ...attrNamesToGet: (keyof BillEntity)[])
  : Promise<BillEntity> {
    return this.getBillWithFlexibleType(congress, ['code', billTypeCode], billNumber, ...attrNamesToGet)
  }

  public getBillWithFlexibleType (congress: number,
                                  billType: [keyof BillTypeEntity, any],
                                  billNumber: number,
                                  ...attrNamesToGet: (keyof BillEntity)[]): Promise<BillEntity> {
    const filterExp = `#k_congress = :v_congress AND #k_billNumber = :v_billNumber AND #k_billType.#k_subKey = :v_billType_subKeyValue`
    const expAttrNames: aws.DynamoDB.DocumentClient.ExpressionAttributeNameMap = {
      '#k_congress': 'congress',
      '#k_billNumber': 'billNumber',
      '#k_billType': 'billType',
      '#k_subKey': billType[0]
    }
    const expAttrVals: aws.DynamoDB.DocumentClient.ExpressionAttributeValueMap = {
      ':v_congress': congress,
      ':v_billNumber': billNumber,
      ':v_billType_subKeyValue': billType[1]
    }
    return super.scanItems<BillEntity>({filterExp, expAttrNames, expAttrVals, attrNamesToGet, flushOut: true}).then(out =>
      (out && out.results && out.results[0]) ? <BillEntity> out.results[0] : null)
  }

  public getAllBillsBySingleKeyFilterPaging (
    key: keyof BillEntity, val: any, attrNamesToGet?: (keyof BillEntity)[], flushOut: boolean = true, lastKey?: string
  ): Promise<BillScanOutput> {
    const filterExp = `#k_key = :v_val`
    const expAttrNames: aws.DynamoDB.DocumentClient.ExpressionAttributeNameMap = {
      '#k_key': key,
    }
    const expAttrVals: aws.DynamoDB.DocumentClient.ExpressionAttributeValueMap = {
      ':v_val': val,
    }
    const input: ScanInput<BillEntity> = { filterExp, expAttrNames, expAttrVals, attrNamesToGet, flushOut }
    if (lastKey) {
      input.lastKey = { 'id': lastKey }
    }
    return super.scanItems<BillEntity>(input).then(out => <BillScanOutput> {
      results: out.results,
      lastKey: out.lastKey && out.lastKey['id']
    })
  }

  public getAllBillsBySingleKeyFilter (key: keyof BillEntity, val: any, attrNamesToGet?: (keyof BillEntity)[]): Promise<BillEntity[]> {
    return this.getAllBillsBySingleKeyFilterPaging(key, val, attrNamesToGet).then(out => out.results)
  }

  public getAllBillsHavingAttributes (keys: (keyof BillEntity)[], ...attrNamesToGet: (keyof BillEntity)[]): Promise<BillEntity[]> {
    return super.getItemsHavingAttributes<BillEntity>(keys, ...attrNamesToGet)
  }

  public getAllBillsNotHavingAttributes (keys: (keyof BillEntity)[], ...attrNamesToGet: (keyof BillEntity)[]): Promise<BillEntity[]> {
    return super.getItemsNotHavingAttributes<BillEntity>(keys, ...attrNamesToGet)
  }

  public getAllBillsPaging (
    attrNamesToGet?: (keyof BillEntity)[], flushOut: boolean = true, lastKey?: string
  ): Promise<BillScanOutput> {
    return super.getAllItems<BillEntity>(attrNamesToGet, flushOut, lastKey ? { 'id': lastKey } : undefined).then(out =>
      <BillScanOutput> {
        results: out.results,
        lastKey: out.lastKey && out.lastKey['id']
      })
  }

  public getAllBills (...attrNamesToGet: (keyof BillEntity)[]): Promise<BillEntity[]> {
    return super.getAllItems<BillEntity>(attrNamesToGet).then(out => out.results)
  }

  public queryBillsByCongress (congress: number, attrNamesToGet?: (keyof BillEntity)[]): Promise<BillScanOutput> {
    let input: QueryInput<BillEntity> = {
      indexName: 'congress-index',
      keyExp: `#k_congress = :v_congress`,
      expAttrNames: {'#k_congress': 'congress'},
      expAttrVals: {':v_congress': congress},
      flushOut: true,
      attrNamesToGet
    }
    return super.queryItem<BillEntity>(input).then(out => <BillScanOutput> {
      results: out.results
    })
  }

  public deleteBills (idx: string[]): Promise<aws.DynamoDB.BatchWriteItemOutput> {
    return (idx && idx.length > 0) ? super.deleteItems('id', idx) : Promise.resolve({})
  }

  public deleteAttributesFromBill (id: string, ...attrName: (keyof BillEntity)[])
  : Promise<aws.DynamoDB.DocumentClient.UpdateItemOutput> {
    return super.deleteAttributesFromItem<BillEntity>('id', id, attrName)
  }

  public deleteTagFromBill (id: string, tag: string)
  : Promise<aws.DynamoDB.DocumentClient.UpdateItemOutput> {
    const params: aws.DynamoDB.DocumentClient.UpdateItemInput = {
      TableName: this.tableName,
      Key: { 'id': id },
      UpdateExpression: `REMOVE #k_tags.#k_tag`,
      ExpressionAttributeNames: {
        '#k_tags': 'tags',
        '#k_tag': tag
      }
    }
    return new Promise((resolve, reject) => {
      this.docClient.update(params, (err, data) => err ? reject(err) : resolve(data))
    })
  }

  public updateBill (id: string, updateBill: BillEntity)
  : Promise<aws.DynamoDB.DocumentClient.UpdateItemOutput> {
    return super.updateItem<BillEntity>('id', id, updateBill)
  }

  public updateTracker (id: string, val: models.Tracker[])
  : Promise<aws.DynamoDB.DocumentClient.UpdateItemOutput> {
    return super.updateItem<BillEntity>('id', id, {'trackers': val})
  }

  public updateSponsor (id: string, val: RoleEntity)
  : Promise<aws.DynamoDB.DocumentClient.UpdateItemOutput> {
    return super.updateItem<BillEntity>('id', id, {'sponsor': val})
  }

  public updateCoSponsors (id: string, val: CosponsorEntity[])
  : Promise<aws.DynamoDB.DocumentClient.UpdateItemOutput> {
    return super.updateItem<BillEntity>('id', id, {'cosponsors': val})
  }

  public updateIntroducedDate (id: string, val: number)
  : Promise<aws.DynamoDB.DocumentClient.UpdateItemOutput> {
    return super.updateItem<BillEntity>('id', id, {'introducedDate': val})
  }

  public updateTagUserCount (tag: string, billId: string, userId: string, count: number)
  : Promise<aws.DynamoDB.DocumentClient.UpdateItemOutput> {
    const params: aws.DynamoDB.DocumentClient.UpdateItemInput = {
      TableName: this.tableName,
      Key: { 'id': billId },
      UpdateExpression: `SET #k_tags.#k_tag.#k_userId = :v_userCount`,
      ExpressionAttributeNames: {
        '#k_tags': 'tags',
        '#k_tag': tag,
        '#k_userId': userId
      },
      ExpressionAttributeValues: {':v_userCount': count}
    }
    return new Promise((resolve, reject) => {
      this.docClient.update(params, (err, data) => err ? reject(err) : resolve(data))
    })
  }
}
