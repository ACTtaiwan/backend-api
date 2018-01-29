import * as aws from 'aws-sdk'
import * as awsConfig from '../../config/aws.json'
import * as models from '../congressGov/CongressGovModels'
import * as _ from 'lodash'

export class DynamoDBManager {
  private static _instance: DynamoDBManager
  private dynamoDb: aws.DynamoDB
  private dynamoDbDocClient: aws.DynamoDB.DocumentClient
  private tables: {[name: string]: Table} = {}

  public static instance (): DynamoDBManager {
    if (!DynamoDBManager._instance) {
      DynamoDBManager._instance = new DynamoDBManager()
    }
    return DynamoDBManager._instance
  }

  private constructor () {
    aws.config.update({region: (<any> awsConfig).metadata.REGION })
    this.dynamoDb = new aws.DynamoDB()
    this.dynamoDbDocClient = new aws.DynamoDB.DocumentClient()
    const tables = [
      new CongressGovSyncAllInfoTable(this.dynamoDbDocClient),
      new CongressGovSyncBillTable(this.dynamoDbDocClient),
      new BillTable(this.dynamoDbDocClient),
      new BillTypeTable(this.dynamoDbDocClient),
      new BillCategoryTable(this.dynamoDbDocClient)
    ]
    this.tables = _.keyBy(tables, x => x.tableName)
  }

  public getTableDescription (tableName: string): Promise<aws.DynamoDB.Types.DescribeTableOutput> {
    const params: aws.DynamoDB.Types.DescribeTableInput = {
      TableName: tableName
    }
    return new Promise((resolve, reject) =>
      this.dynamoDb.describeTable(params, (err, data) => err ? reject(err) : resolve(data))
    )
  }

  public isTableExist (tableName: string): Promise<boolean> {
    return this.getTableDescription(tableName)
      .then(() => Promise.resolve(true))
      .catch((err) => Promise.resolve(false))
  }

  public createTableIfNotExist (tableName: string, checkExist: boolean = true): Promise<aws.DynamoDB.Types.CreateTableOutput> {
    const chkTblPromise: Promise<boolean> = checkExist ?
      this.isTableExist(tableName) :
      Promise.resolve(false)

    return chkTblPromise.then(exist => {
      if (exist) {
        return Promise.resolve(null)
      } else {
        const tableDef = this.tables[tableName] && this.tables[tableName].tableDefinition
        if (!tableDef) {
          return Promise.reject('table definition can not be found')
        }
        const params: aws.DynamoDB.Types.CreateTableInput = {
          TableName: tableName,
          KeySchema: tableDef[0],
          AttributeDefinitions: tableDef[1],
          ProvisionedThroughput: {
            ReadCapacityUnits: 5,
            WriteCapacityUnits: 5
          }
        }
        return new Promise((resolve, reject) =>
          this.dynamoDb.createTable(params, (err, data) => err ? reject(err) : resolve(data))
        )
      }
    })
  }

  public deleteTable (tableName: string) {
    return new Promise((resolve, reject) =>
      this.dynamoDb.deleteTable({TableName: tableName}, (err, data) => err ? reject(err) : resolve(data))
    )
  }

  public getTable (tableName: string): Table {
    return this.tables[tableName]
  }
}

export interface TableEntity {}

export abstract class Table {
  public abstract get tableName (): string
  public abstract get tableDefinition (): [aws.DynamoDB.KeySchema, aws.DynamoDB.AttributeDefinitions]

  protected docClient: aws.DynamoDB.DocumentClient

  constructor (db: aws.DynamoDB.DocumentClient) {
    this.docClient = db;
  }

  protected getItem (keyName: string, keyValue: string): Promise<aws.DynamoDB.DocumentClient.GetItemOutput> {
    let key: aws.DynamoDB.DocumentClient.Key = {}
    key[ keyName ] = keyValue

    let params: aws.DynamoDB.DocumentClient.GetItemInput = {
      TableName: this.tableName,
      Key: key
    }

    return new Promise((resolve, reject) => {
      this.docClient.get(params, (err, data) => err ? reject(err) : resolve(data))
    })
  }

  protected getItems (keyName: string, keyValues: string[]): Promise<aws.DynamoDB.DocumentClient.BatchGetItemOutput> {
    const keys: aws.DynamoDB.DocumentClient.Key[] = _.map(keyValues, keyValue => {
      let key: aws.DynamoDB.DocumentClient.Key = {}
      key[ keyName ] = keyValue
      return key
    })

    const itemsMap: aws.DynamoDB.DocumentClient.BatchGetRequestMap = {}
    itemsMap[this.tableName] = { Keys: keys };

    const params: aws.DynamoDB.DocumentClient.BatchGetItemInput = {
      RequestItems: itemsMap
    }

    return new Promise((resolve, reject) => {
      this.docClient.batchGet(params, (err, data) => err ? reject(err) : resolve(data))
    })
  }

  protected getAllItems (attrNamesToGet?: string[]): Promise<aws.DynamoDB.DocumentClient.ScanOutput> {
    let params: aws.DynamoDB.DocumentClient.ScanInput = {
      TableName: this.tableName
    }

    if (attrNamesToGet && attrNamesToGet.length > 0) {
      params.ProjectionExpression = attrNamesToGet.join(', ')
    }

    return new Promise((resolve, reject) => {
      this.docClient.scan(params, (err, data) => err ? reject(err) : resolve(data))
    })
  }

  protected getItemsByFilter (filterExp: aws.DynamoDB.DocumentClient.ConditionExpression,
                              expAttrNames: aws.DynamoDB.DocumentClient.ExpressionAttributeNameMap,
                              expAttrVals: aws.DynamoDB.DocumentClient.ExpressionAttributeValueMap,
                              attrNamesToGet?: string[])
  : Promise<aws.DynamoDB.DocumentClient.ScanOutput> {
    let params: aws.DynamoDB.DocumentClient.ScanInput = {
      TableName: this.tableName,
      FilterExpression: filterExp,
      ExpressionAttributeNames: expAttrNames,
      ExpressionAttributeValues: expAttrVals
    }

    if (attrNamesToGet && attrNamesToGet.length > 0) {
      params.ProjectionExpression = attrNamesToGet.join(', ')
    }

    return new Promise((resolve, reject) => {
      this.docClient.scan(params, (err, data) => err ? reject(err) : resolve(data))
    })
  }

  protected getItemsHavingAttributes<T extends TableEntity> (keys: (keyof T)[], ...attrNamesToGet: (keyof BillEntity)[])
  : Promise<T[]> {
    const filterExp = _.map(keys, k => `attribute_exists(${k})`).join(' AND ')
    return this.getItemsByFilter(filterExp, undefined, undefined, attrNamesToGet).then(data =>
      (data && data.Items) ? <T[]> data.Items : null)
  }

  protected getItemsNotHavingAttributes<T extends TableEntity> (keys: (keyof T)[], ...attrNamesToGet: (keyof BillEntity)[])
  : Promise<T[]> {
    const filterExp = _.map(keys, k => `attribute_not_exists(${k})`).join(' AND ')
    return this.getItemsByFilter(filterExp, undefined, undefined, attrNamesToGet).then(data =>
      (data && data.Items) ? <T[]> data.Items : null)
  }

  protected putItem (item: TableEntity): Promise<aws.DynamoDB.DocumentClient.PutItemOutput> {
    let params: aws.DynamoDB.DocumentClient.PutItemInput = {
      TableName: this.tableName,
      Item: item
    }

    return new Promise((resolve, reject) => {
      this.docClient.put(params, (err, data) => err ? reject(err) : resolve(data))
    })
  }

  protected updateItem<T extends TableEntity> (keyName: string, keyValue: string, ...obj: [keyof T, any][])
  : Promise<aws.DynamoDB.DocumentClient.UpdateItemOutput> {
    let exps = []
    let expKey = {}
    let expVal = {}

    _.each(obj, (entry: [keyof T, any]) => {
      const key = entry[0]
      const val = entry[1]
      const keySub = '#k_' + key
      const valSub = ':v_' + key
      exps.push(`${keySub} = ${valSub}`)
      expKey[keySub] = key
      expVal[valSub] = val
    })

    const exp = 'SET ' + exps.join(', ')

    let key: aws.DynamoDB.DocumentClient.Key = {}
    key[ keyName ] = keyValue

    const params: aws.DynamoDB.DocumentClient.UpdateItemInput = {
      TableName: this.tableName,
      Key: key,
      UpdateExpression: exp,
      ExpressionAttributeNames: expKey,
      ExpressionAttributeValues: expVal
    }

    return new Promise((resolve, reject) => {
      this.docClient.update(params, (err, data) => err ? reject(err) : resolve(data))
    })
  }

  protected deleteAttributesFromItem<T extends TableEntity> (keyName: string, keyValue: string, attrName: (keyof T)[])
  : Promise<aws.DynamoDB.DocumentClient.UpdateItemOutput> {
    const exp = `REMOVE ${attrName.join(', ')}`
    let key: aws.DynamoDB.DocumentClient.Key = {}
    key[ keyName ] = keyValue

    const params: aws.DynamoDB.DocumentClient.UpdateItemInput = {
      TableName: this.tableName,
      Key: key,
      UpdateExpression: exp
    }

    return new Promise((resolve, reject) => {
      this.docClient.update(params, (err, data) => err ? reject(err) : resolve(data))
    })
  }

  protected deleteItems (keyName: string, keyValues: string[]): Promise<aws.DynamoDB.DocumentClient.BatchWriteItemOutput> {
    const items = _.map(keyValues, keyValue => {
      let key: aws.DynamoDB.DocumentClient.Key = {}
      key[ keyName ] = keyValue
      return <aws.DynamoDB.DocumentClient.WriteRequest> {
        DeleteRequest: { Key: key }
      }
    })

    const itemsMap: aws.DynamoDB.DocumentClient.BatchWriteItemRequestMap = {}
    itemsMap[this.tableName] = items;

    const params: aws.DynamoDB.DocumentClient.BatchWriteItemInput = {
      RequestItems: itemsMap
    }

    return new Promise((resolve, reject) => {
      this.docClient.batchWrite(params, (err, data) => err ? reject(err) : resolve(data))
    })
  }
}

// CongressGovSyncAllInfoTable

export interface CongressGovSyncAllInfoEntity extends TableEntity {
  urlPath: string
  rawData: string
  lastUpdate?: number
}

export class CongressGovSyncAllInfoTable extends Table {
  public readonly tableName = (<any> awsConfig).dynamodb.CONGRESSGOV_SYNC_ALL_INFO_TABLE_NAME

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

  public putObject (obj: CongressGovSyncAllInfoEntity): Promise<aws.DynamoDB.DocumentClient.PutItemOutput> {
    obj.lastUpdate = new Date().getTime()
    return super.putItem(obj)
  }
}

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

  public getObjectByUrlPath (url: string): Promise<CongressGovSyncBillEntity> {
    return super.getItem('urlPath', url).then(data =>
      (data && data.Item) ? <CongressGovSyncBillEntity> data.Item : null)
  }
}

// CategoryTable

export interface BillCategoryEntity extends TableEntity {
  id: string
  code: string
  name: string
  name_zh?: string
  description?: string
  description_zh?: string
}

export class BillCategoryTable extends Table {
  public readonly tableName = (<any> awsConfig).dynamodb.VOLUNTEER_BILLCATEGORIES_TABLE_NAME

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

  public getAllCategories (): Promise<BillCategoryEntity[]> {
    return super.getAllItems().then(data =>
      (data && data.Items) ? <BillCategoryEntity[]> data.Items : null)
  }
}

// BillTable

export interface BillTypeEntity extends TableEntity {
  id: string
  chamber: models.ChamberType
  code: models.BillTypeCode
  display: string
  name: string
}

export class BillTypeTable extends Table {
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
    return super.getAllItems().then(data =>
      (data && data.Items) ? <BillTypeEntity[]> data.Items : null)
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
    return super.getItemsByFilter(filterExp, expAttrNames, expAttrVals).then(data =>
      (data && data.Items) ? <BillTypeEntity[]> data.Items : null)
  }
}

// BillTable

type Unknown = any

export interface BillEntity extends TableEntity {
  id: string
  congress: number
  billNumber: number
  title: string
  title_zh?: string
  billType?: BillTypeEntity
  categories?: BillCategoryEntity[]
  tags?: string[]
  trackers?: models.Tracker[]
  currentChamber?: models.ChamberType
  actions?: Unknown[]
  sponsor?: Unknown
  cosponsors?: Unknown[]
  relevence?: number,
  china?: string,
  insight?: string,
  comment?: string
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

  public getBillById (id: string): Promise<BillEntity> {
    return super.getItem('id', id).then(data =>
      (data && data.Item) ? <BillEntity> data.Item : null)
  }

  public getBillsById (idx: string[]): Promise<BillEntity[]> {
    return super.getItems('id', idx).then(data =>
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
    return super.getItemsByFilter(filterExp, expAttrNames, expAttrVals, attrNamesToGet).then(data =>
      (data && data.Items && data.Items[0]) ? <BillEntity> data.Items[0] : null)
  }

  public getAllBillsBySingleKeyFilter (key: keyof BillEntity, val: any, ...attrNamesToGet: (keyof BillEntity)[]): Promise<BillEntity[]> {
    const filterExp = `#k_key = :v_val`
    const expAttrNames: aws.DynamoDB.DocumentClient.ExpressionAttributeNameMap = {
      '#k_key': key,
    }
    const expAttrVals: aws.DynamoDB.DocumentClient.ExpressionAttributeValueMap = {
      ':v_val': val,
    }
    return super.getItemsByFilter(filterExp, expAttrNames, expAttrVals, attrNamesToGet).then(data =>
      (data && data.Items) ? <BillEntity[]> data.Items : null)
  }

  public getAllBillsHavingAttributes (keys: (keyof BillEntity)[], ...attrNamesToGet: (keyof BillEntity)[]): Promise<BillEntity[]> {
    return super.getItemsHavingAttributes<BillEntity>(keys, ...attrNamesToGet)
  }

  public getAllBillsNotHavingAttributes (keys: (keyof BillEntity)[], ...attrNamesToGet: (keyof BillEntity)[]): Promise<BillEntity[]> {
    return super.getItemsNotHavingAttributes<BillEntity>(keys, ...attrNamesToGet)
  }

  public getAllBills (...attrNamesToGet: (keyof BillEntity)[]): Promise<BillEntity[]> {
    return super.getAllItems(attrNamesToGet).then(data =>
      (data && data.Items) ? <BillEntity[]> data.Items : null)
  }

  public deleteBills (idx: string[]): Promise<aws.DynamoDB.BatchWriteItemOutput> {
    return (idx && idx.length > 0) ? super.deleteItems('id', idx) : Promise.resolve({})
  }

  public deleteAttributesFromBill (id: string, ...attrName: (keyof BillEntity)[])
  : Promise<aws.DynamoDB.DocumentClient.UpdateItemOutput> {
    return super.deleteAttributesFromItem<BillEntity>('id', id, attrName)
  }

  public updateBill (id: string, updateBill: BillEntity)
  : Promise<aws.DynamoDB.DocumentClient.UpdateItemOutput> {
    let kvPairs = []
    _.each(updateBill, (v, k) => kvPairs.push([k, v]))
    return super.updateItem<BillEntity>('id', id, ...kvPairs)
  }

  public updateTracker (id: string, val: models.Tracker[])
  : Promise<aws.DynamoDB.DocumentClient.UpdateItemOutput> {
    return super.updateItem<BillEntity>('id', id, ['trackers', val])
  }
}

export class DbHelper {
  public static displayBill (bill: BillEntity) {
    return `${bill.congress}-${bill.billType.code}-${bill.billNumber} (${bill.id})`
  }
}
