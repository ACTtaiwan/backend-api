import * as aws from 'aws-sdk'
import * as awsConfig from '../../config/aws.json'
import * as models from '../congressGov/CongressGovModels'
import * as _ from 'lodash'
import { CongressGovSyncBillTable, BillTable, TagTable, TagMetaTable, CongressTable,
  RoleTable, PersonTable, BillTypeTable, BillCategoryTable, BillVersionTable, BulkPeopleTable } from './'

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
    const tables = <Table[]> [
      new CongressGovSyncBillTable(this.dynamoDbDocClient),
      new BillTable(this.dynamoDbDocClient),
      new BillTypeTable(this.dynamoDbDocClient),
      new BillCategoryTable(this.dynamoDbDocClient, this.dynamoDb),
      new BillVersionTable(this.dynamoDbDocClient),
      new PersonTable(this.dynamoDbDocClient),
      new RoleTable(this.dynamoDbDocClient, this.dynamoDb),
      new TagTable(this.dynamoDbDocClient, this.dynamoDb),
      new TagMetaTable(this.dynamoDbDocClient),
      new BulkPeopleTable(this.dynamoDbDocClient),
      new CongressTable(this.dynamoDbDocClient, this.dynamoDb)
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

  public getTable<T extends Table> (tableName: string): T {
    return <T> this.tables[tableName]
  }
}

export interface TableEntity {}

export interface ScanInput<T> {
  filterExp?: aws.DynamoDB.DocumentClient.ConditionExpression,
  expAttrNames?: aws.DynamoDB.DocumentClient.ExpressionAttributeNameMap,
  expAttrVals?: aws.DynamoDB.DocumentClient.ExpressionAttributeValueMap,
  attrNamesToGet?: (keyof T)[],
  lastKey?: aws.DynamoDB.DocumentClient.Key,
  flushOut?: boolean,
  maxItems?: number
}

export interface ScanOutput<T> {
  results: T[],
  lastKey?: aws.DynamoDB.DocumentClient.Key
}

export interface QueryInput<T> extends ScanInput<T> {
  keyExp: aws.DynamoDB.DocumentClient.KeyExpression
  indexName?: aws.DynamoDB.DocumentClient.IndexName
}

export abstract class Table<HydrateField = string> {
  public abstract get tableName (): string
  public abstract get tableDefinition (): [aws.DynamoDB.KeySchema, aws.DynamoDB.AttributeDefinitions]

  protected docClient: aws.DynamoDB.DocumentClient
  protected db: aws.DynamoDB

  private _hydrateFields: HydrateField[] = []
  private _useHydrateFields: boolean = true

  constructor (docClient: aws.DynamoDB.DocumentClient, db?: aws.DynamoDB) {
    this.docClient = docClient
    this.db = db
  }

  public set hydrateFields (v: HydrateField[]) {
    this._hydrateFields = (v && _.uniq(v)) || []
  }

  public get hydrateFields () {
    return this._hydrateFields
  }

  public get hasHydrateFields () {
    return this._hydrateFields && this._hydrateFields.length > 0
  }

  public set useHydrateFields (flag: boolean) {
    this._useHydrateFields = flag
  }

  public get useHydrateFields () {
    return this._useHydrateFields && this.hasHydrateFields
  }

  public describe (): Promise<aws.DynamoDB.DescribeTableOutput> {
    let db = this.db || new aws.DynamoDB()
    return new Promise((resolve, reject) => {
      db.describeTable({TableName: this.tableName}, (err, data) => err ? reject(err) : resolve(data))
    })
  }

  protected getItem<T extends TableEntity, KeyType = string> (
    keyName: string, keyValue: KeyType, attrNamesToGet?: (keyof T)[]
  ): Promise<aws.DynamoDB.DocumentClient.GetItemOutput> {
    let key: aws.DynamoDB.DocumentClient.Key = {}
    key[ keyName ] = keyValue

    let params: aws.DynamoDB.DocumentClient.GetItemInput = {
      TableName: this.tableName,
      Key: key
    }

    if (attrNamesToGet && attrNamesToGet.length > 0) {
      params.AttributesToGet = attrNamesToGet
    }

    return new Promise((resolve, reject) => {
      this.docClient.get(params, (err, data) => err ? reject(err) : resolve(data))
    })
  }

  protected getItemWithSortKey<T extends TableEntity> (
    keyName: string, keyValue: string, sortKeyName: string, sortKeyValue: string, attrNamesToGet?: (keyof T)[]
  ): Promise<aws.DynamoDB.DocumentClient.GetItemOutput> {
    let key: aws.DynamoDB.DocumentClient.Key = {}
    key[ keyName ] = keyValue
    key[ sortKeyName ] = sortKeyValue

    let params: aws.DynamoDB.DocumentClient.GetItemInput = {
      TableName: this.tableName,
      Key: key
    }

    if (attrNamesToGet && attrNamesToGet.length > 0) {
      params.AttributesToGet = attrNamesToGet
    }

    return new Promise((resolve, reject) => {
      this.docClient.get(params, (err, data) => err ? reject(err) : resolve(data))
    })
  }

  public async forEachBatch<T extends TableEntity> (
    keyName: string,
    callback: (batch: T[], lastKey?: string) => Promise<boolean | void>,
    attrNamesToGet?: (keyof T)[]
  ): Promise<void> {
    let lastKey: string
    while (true) {
      let awsKey: aws.DynamoDB.DocumentClient.Key
      if (lastKey) {
        awsKey = {}
        awsKey[keyName] = lastKey
      }
      let out = await this.getAllItems<T>(attrNamesToGet, false, awsKey)
      if (out) {
        lastKey = out.lastKey && out.lastKey[keyName]
        let goNext: boolean | void = await callback(out.results, lastKey)
        if (typeof goNext === 'boolean') {
          goNext = <boolean> goNext
        } else {
          goNext = true
        }
        if (!lastKey || !goNext) {
          break
        }
      }
    }
    return Promise.resolve()
  }

  protected getItemsBatch <T extends TableEntity, KeyType = string> (
    keyName: string, keyValues: KeyType[], attrNamesToGet?: (keyof T)[]
  ): Promise<aws.DynamoDB.DocumentClient.BatchGetItemOutput> {
    const keys: aws.DynamoDB.DocumentClient.Key[] = _.map(keyValues, keyValue => {
      let key: aws.DynamoDB.DocumentClient.Key = {}
      key[ keyName ] = keyValue
      return key
    })

    const itemsMap: aws.DynamoDB.DocumentClient.BatchGetRequestMap = {}
    itemsMap[this.tableName] = { Keys: keys };

    if (attrNamesToGet && attrNamesToGet.length > 0) {
      itemsMap[this.tableName].AttributesToGet = attrNamesToGet
    }

    const params: aws.DynamoDB.DocumentClient.BatchGetItemInput = {
      RequestItems: itemsMap
    }

    return new Promise((resolve, reject) => {
      this.docClient.batchGet(params, (err, data) => err ? reject(err) : resolve(data))
    })
  }

  protected getItems <T extends TableEntity, KeyType = string> (
    keyName: string, keyValues: KeyType[], attrNamesToGet?: (keyof T)[]
  ): Promise<T[]> {
    const batchSize = 70
    const copyKeyValues = _.clone(keyValues)
    const promises: Promise<T[]>[] = []
    while (!_.isEmpty(copyKeyValues)) {
      const batchIdx = copyKeyValues.splice(0, batchSize)
      if (batchIdx.length === 0) {
        promises.push(Promise.resolve([]))
      } else {
        const promise = this.getItemsBatch<T, KeyType>(keyName, batchIdx, attrNamesToGet).then(data =>
          (data && data.Responses && data.Responses[this.tableName]) ? <T[]> data.Responses[this.tableName] : null)
        promises.push(promise)
      }
    }
    return Promise.all(promises).then((res: T[][]) => _.flatten(res))
  }

  protected async getAllItems<T extends TableEntity> (
    attrNamesToGet?: (keyof T)[], flushOut: boolean = true, lastKey?: aws.DynamoDB.DocumentClient.Key
  ): Promise<ScanOutput<T>> {
    const options: ScanInput<T> = {flushOut, lastKey}
    if (attrNamesToGet && attrNamesToGet.length > 0) {
      options.attrNamesToGet = []
      options.expAttrNames = {}
      _.each(attrNamesToGet, attr => {
        options.attrNamesToGet.push(<any> `#k_${attr}`)
        options.expAttrNames[ `#k_${attr}` ] = attr
      })
    }
    return this.scanItems<T>(options)
  }

  protected async scanItems<T extends TableEntity> (options: ScanInput<T> = {}): Promise<ScanOutput<T>> {
    let params: aws.DynamoDB.DocumentClient.ScanInput = {
      TableName: this.tableName
    }

    if (options.filterExp) {
      params.FilterExpression = options.filterExp
    }

    if (options.expAttrNames) {
      params.ExpressionAttributeNames = options.expAttrNames;
    }

    if (options.expAttrVals) {
      params.ExpressionAttributeValues = options.expAttrVals;
    }

    if (options.attrNamesToGet && options.attrNamesToGet.length > 0) {
      params.ProjectionExpression = options.attrNamesToGet.join(', ')
    }

    if (options.lastKey) {
      params.ExclusiveStartKey = options.lastKey
    }

    if (options.flushOut) {
      // flush out
      let items: T[] = []
      while (true) {
        let data = await this.docClient.scan(params).promise()
        if (data && data.Items) {
          console.log(`[${this.tableName}] batch items fetched = ` + data.Items.length)
          items = [...items, ...(data.Items as T[])]
          if (options.maxItems && items.length >= options.maxItems) {
            break
          } else {
            if (data.LastEvaluatedKey) {
              params.ExclusiveStartKey = data.LastEvaluatedKey
            } else {
              break
            }
          }
        } else {
          break
        }
      }
      return Promise.resolve({results: items})
    } else {
      // use paging
      let data = await this.docClient.scan(params).promise()
      if (data && data.Items) {
        let rtn = <ScanOutput<T>> { results: data.Items }
        if (data.LastEvaluatedKey) {
          rtn.lastKey = data.LastEvaluatedKey
        }
        return Promise.resolve(rtn)
      } else {
        return Promise.resolve({results: []})
      }
    }
  }

  protected async queryItem<T extends TableEntity> (options: QueryInput<T>): Promise<ScanOutput<T>> {
    let params: aws.DynamoDB.DocumentClient.QueryInput = {
      TableName: this.tableName,
      KeyConditionExpression: options.keyExp,
    }

    if (options.indexName) {
      params.IndexName = options.indexName
    }

    if (options.filterExp) {
      params.FilterExpression = options.filterExp
    }

    if (options.expAttrNames) {
      params.ExpressionAttributeNames = options.expAttrNames;
    }

    if (options.expAttrVals) {
      params.ExpressionAttributeValues = options.expAttrVals;
    }

    if (options.attrNamesToGet && options.attrNamesToGet.length > 0) {
      params.ProjectionExpression = options.attrNamesToGet.join(', ')
    }

    if (options.lastKey) {
      params.ExclusiveStartKey = options.lastKey
    }

    if (options.flushOut) {
      // flush out
      let items: T[] = []
      while (true) {
        let data = await this.docClient.query(params).promise()
        if (data && data.Items) {
          console.log(`batch items queried = ` + data.Items.length)
          items = [...items, ...(data.Items as T[])]
          if (data.LastEvaluatedKey) {
            params.ExclusiveStartKey = data.LastEvaluatedKey
          } else {
            break
          }
        } else {
          break
        }
      }
      return Promise.resolve({results: items})
    } else {
      // use paging
      let data = await this.docClient.scan(params).promise()
      if (data && data.Items) {
        let rtn = <ScanOutput<T>> { results: data.Items }
        if (data.LastEvaluatedKey) {
          rtn.lastKey = data.LastEvaluatedKey
        }
        return Promise.resolve(rtn)
      } else {
        return Promise.resolve({results: []})
      }
    }
  }

  protected getItemsHavingAttributes<T extends TableEntity> (keys: (keyof T)[], ...attrNamesToGet: (keyof T)[]): Promise<T[]> {
    const filterExp = _.map(keys, k => `attribute_exists(${k})`).join(' AND ')
    return this.scanItems<T>({filterExp, attrNamesToGet, flushOut: true}).then(out => out.results)
  }

  protected getItemsNotHavingAttributes<T extends TableEntity> (keys: (keyof T)[], ...attrNamesToGet: (keyof T)[]): Promise<T[]> {
    const filterExp = _.map(keys, k => `attribute_not_exists(${k})`).join(' AND ')
    return this.scanItems<T>({filterExp, attrNamesToGet, flushOut: true}).then(out => out.results)
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

  protected updateItem<T extends TableEntity> (
    keyName: string, keyValue: string, obj: {[key in keyof T]?: any}, sortKeyName?: string, sortKeyValue?: string
  ): Promise<aws.DynamoDB.DocumentClient.UpdateItemOutput> {
    let exps = []
    let expKey = {}
    let expVal = {}

    _.each(obj, (val, key) => {
      const keySub = '#k_' + key
      const valSub = ':v_' + key
      exps.push(`${keySub} = ${valSub}`)
      expKey[keySub] = key
      expVal[valSub] = val
    })

    const exp = 'SET ' + exps.join(', ')

    let key: aws.DynamoDB.DocumentClient.Key = {}
    key[ keyName ] = keyValue
    if (sortKeyName && sortKeyValue) {
      key[ sortKeyName ] = sortKeyValue
    }

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

  protected addValueToSetAttribute<T extends TableEntity> (keyName: string, keyValue: string, attrName: (keyof T), val: any)
  : Promise<aws.DynamoDB.DocumentClient.UpdateItemOutput> {
    let expKey = {}
    let expVal = {}

    const keySub = '#k_' + attrName
    const valSub = ':v_' + attrName
    expKey[keySub] = attrName
    expVal[valSub] = [val]

    const exp = `SET ${keySub} = list_append(${keySub}, ${valSub})`

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

  protected deleteAttributesFromItem<T extends TableEntity, KeyType = string> (keyName: string, keyValue: KeyType, attrName: (keyof T)[])
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

  protected deleteItem (keyName: string, keyValue: string): Promise<aws.DynamoDB.DocumentClient.DeleteItemOutput> {
    let key: aws.DynamoDB.DocumentClient.Key = {}
    key[ keyName ] = keyValue

    let params: aws.DynamoDB.DocumentClient.DeleteItemInput = {
      TableName: this.tableName,
      Key: key
    }

    return new Promise((resolve, reject) => {
      this.docClient.delete(params, (err, data) => err ? reject(err) : resolve(data))
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
