import * as aws from 'aws-sdk'
import * as awsConfig from '../../config/aws.json'
import { PersonEntity, TableEntity, Table, BillEntity, DynamoDBManager, PersonTable, QueryInput } from './'
import * as _ from 'lodash'

// RoleTable

export type SponsorType = 'sponsor' | 'cosponsor'

export interface RoleEntity extends TableEntity {
  id: string
  person?: PersonEntity // [@nonDBStored]
  personId?: string

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

export type RoleEntityHydrateField = 'person' | 'billSponsored' | 'billCosponsored'

export class RoleTable extends Table<RoleEntityHydrateField> {
  public readonly tableName = (<any> awsConfig).dynamodb.VOLUNTEER_ROLES_TABLE_NAME

  constructor (docClient: aws.DynamoDB.DocumentClient, db: aws.DynamoDB) {
    super(docClient, db)
    this.hydrateFields = ['person']
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
    return super.getItems<RoleEntity>('id', idx, attrNamesToGet).then(items => this.applyHydrateFields(items))
  }

  public async forEachBatchOfAllRoles (
      callback: (batchRoles: RoleEntity[], lastKey?: string) => Promise<boolean | void>,
      attrNamesToGet?: (keyof RoleEntity)[]
  ) {
    super.forEachBatch('id', callback, attrNamesToGet)
  }

  public getRolesByCongress (congress: number, ...attrNamesToGet: (keyof RoleEntity)[]): Promise<RoleEntity[]> {
    const filterExp = `contains( congressNumbers, :v_congress )`
    const expAttrVals: aws.DynamoDB.DocumentClient.ExpressionAttributeValueMap = {
      ':v_congress': congress,
    }
    return super.scanItems<RoleEntity>({filterExp, expAttrVals, attrNamesToGet, flushOut: true}).then(out =>
      _.map(out.results, (r: any) => this.convertAttrMapToBillRoleEntity(r))).then(items => this.applyHydrateFields(items))
  }

  public getRolesByBioGuideId (bioGuideId: string, attrNamesToGet?: (keyof RoleEntity)[]): Promise<RoleEntity[]> {
    let tblPplName = (<any> awsConfig).dynamodb.VOLUNTEER_PERSON_TABLE_NAME
    let tblPpl = DynamoDBManager.instance().getTable<PersonTable>(tblPplName)
    return tblPpl.getPersonByBioGuideId(bioGuideId).then(person =>
      person ? this.getRolesByPersonId(person.id).then(roles => this.hasHydrateFields ? this.applyHydrateFields(roles) : roles) : null)
  }

  public getRolesByPersonId (personId: string, attrNamesToGet?: (keyof RoleEntity)[]): Promise<RoleEntity[]> {
    let input: QueryInput<RoleEntity> = {
      indexName: 'personId-index',
      keyExp: `#k_key = :v_key`,
      expAttrNames: {'#k_key': 'personId'},
      expAttrVals: {':v_key': personId},
      flushOut: true,
      attrNamesToGet
    }
    return super.queryItem<RoleEntity>(input).then(out =>
      out.results ? _.map(out.results, (r: any) => this.convertAttrMapToBillRoleEntity(r)) : null
    )
  }

  public getRolesHavingSponsoredBills (type: SponsorType): Promise<RoleEntity[]> {
    let attrName: (keyof RoleEntity) = (type === 'sponsor') ? 'billIdSponsored' : 'billIdCosponsored'
    return super.getItemsHavingAttributes<RoleEntity>([attrName]).then(out =>
      _.map(out, (r: any) => this.convertAttrMapToBillRoleEntity(r))).then(items =>
      this.hydrateFields ? this.applyHydrateFields(items) : items)
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

  public deleteAttributesFromRole (id: string, ...attrName: (keyof RoleEntity)[])
  : Promise<aws.DynamoDB.DocumentClient.UpdateItemOutput> {
    return super.deleteAttributesFromItem<RoleEntity>('id', id, attrName)
  }

  public updateRole (id: string, updateRole: RoleEntity)
  : Promise<aws.DynamoDB.DocumentClient.UpdateItemOutput> {
    return super.updateItem<RoleEntity>('id', id, updateRole)
  }

  public async applyHydrateFields (roles: RoleEntity[]): Promise<RoleEntity[]> {
    if (!this.hasHydrateFields) {
      return roles
    }

    let tblPplName = (<any> awsConfig).dynamodb.VOLUNTEER_PERSON_TABLE_NAME
    let tblPpl = DynamoDBManager.instance().getTable<PersonTable>(tblPplName)
    if (_.includes<RoleEntityHydrateField>(this.hydrateFields, 'person')) {
      let pplIdx = _.uniq(_.filter(_.map(roles, x => x.personId), _.identity))
      let pplItems = _.keyBy(await tblPpl.getPersonsById(pplIdx), 'id')
      _.each(roles, r => r.personId && (r.person = pplItems[r.personId]))
    }
    return roles
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
