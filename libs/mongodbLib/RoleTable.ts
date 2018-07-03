import * as mongodb from 'mongodb'
import { MongoDBTable } from './'
import { MongoDbConfig } from '../../config/mongodb'
import * as dbLib from '../dbLib'
import * as _ from 'lodash'
import * as mongoDbLib from './';
import { EntryType } from './MongoDBManager';

export class RoleTable extends MongoDBTable<dbLib.RoleEntityHydrateField> {
  public readonly tableName = MongoDbConfig.tableNames.ROLES_TABLE_NAME
  protected readonly suggestPageSize: number = 1000

  constructor (db: mongodb.Db) {
    super(db)
    this.hydrateFields = ['person']
  }

  public getRoleById (id: string, ...attrNamesToGet: (keyof dbLib.RoleEntity)[]): Promise<dbLib.RoleEntity> {
    return super.getItem<dbLib.RoleEntity>('_id', id, this.applyHydrateFieldsForAttrNames(attrNamesToGet))
      .then(async data => data ? (await this.applyHydrateFields([data]))[0] : null)
  }

  public getRolesById (idx: string[], ...attrNamesToGet: (keyof dbLib.RoleEntity)[]): Promise<dbLib.RoleEntity[]> {
    return super.getItems<dbLib.RoleEntity>('_id', idx, this.applyHydrateFieldsForAttrNames(attrNamesToGet))
      .then(items => this.applyHydrateFields(items))
  }

  public async forEachBatchOfAllRoles (
    callback: (batchRoles: dbLib.RoleEntity[]) => Promise<boolean | void>,
    attrNamesToGet?: (keyof dbLib.RoleEntity)[]
  ): Promise<void> {
    return super.forEachBatch<dbLib.RoleEntity>(callback, attrNamesToGet)
  }

  public queryRoles (
      personId?: string | string[],
      state?: string | string[],
      congress?: number | number[],
      attrNamesToGet?: (keyof dbLib.RoleEntity)[]
  ): Promise<dbLib.RoleEntity[]> {
    let queryPerson = super.composeQueryOfSingleOrMultipleValues('personId', personId)
    let queryState = super.composeQueryOfSingleOrMultipleValues('state', state)
    let queryCongress = super.composeQueryOfSingleOrMultipleValues('congressNumbers', congress)
    let query = _.merge(queryPerson, queryState, queryCongress)
    console.log(`[RoleTable::queryRole()] query = ${JSON.stringify(query, null, 2)}`)
    return super.queryItems<dbLib.RoleEntity>(query, this.applyHydrateFieldsForAttrNames(attrNamesToGet))
      .then(items => this.applyHydrateFields(items))
  }

  public getRolesByPersonId (personId?: string | string[], attrNamesToGet?: (keyof dbLib.RoleEntity)[]): Promise<dbLib.RoleEntity[]> {
    return this.queryRoles(personId, null, null, attrNamesToGet)
  }

  public getRolesHavingSponsoredBills (type: dbLib.SponsorType): Promise<dbLib.RoleEntity[]> {
    let attrName: (keyof dbLib.RoleEntity) = (type === 'sponsor') ? 'billIdSponsored' : 'billIdCosponsored'
    return super.getItemsHavingAttributes<dbLib.RoleEntity>([attrName])
      .then(items => this.applyHydrateFields(items))
  }

  public setBillIdArrayToRole (id: string, billIdx: string[], type: dbLib.SponsorType): Promise<mongodb.WriteOpResult> {
    let attrName: (keyof dbLib.RoleEntity) = (type === 'sponsor') ? 'billIdSponsored' : 'billIdCosponsored'
    let updateItem: EntryType<dbLib.RoleEntity> = {}
    updateItem[ attrName ] = _.uniq(billIdx)
    return super.updateItemByObjectId<dbLib.RoleEntity>(id, updateItem)
  }

  public addBillToRole (id: string, billId: string, type: dbLib.SponsorType): Promise<mongodb.WriteOpResult> {
    let attrName: (keyof dbLib.RoleEntity) = (type === 'sponsor') ? 'billIdSponsored' : 'billIdCosponsored'
    let updateItem: EntryType<dbLib.RoleEntity> = {}
    updateItem[ attrName ] = billId
    let query = { $addToSet: updateItem }
    return this.getTable<dbLib.RoleEntity>().update({ '_id': id }, query)
  }

  public removeBillFromRole (id: string, billId: string, type: dbLib.SponsorType): Promise<mongodb.WriteOpResult>  {
    let attrName: (keyof dbLib.RoleEntity) = (type === 'sponsor') ? 'billIdSponsored' : 'billIdCosponsored'
    let updateItem: EntryType<dbLib.RoleEntity> = {}
    updateItem[ attrName ] = billId
    let query = { $pull: updateItem }
    return this.getTable<dbLib.RoleEntity>().update({ '_id': id }, query)
  }

  public removeAllBillsFromRole (id: string, type?: dbLib.SponsorType): Promise<mongodb.WriteOpResult>  {
    let attrName: (keyof dbLib.RoleEntity) = (type === 'sponsor') ? 'billIdSponsored' : 'billIdCosponsored'
    return super.deleteAttributesFromItem<dbLib.RoleEntity>(id, [attrName])
  }

  public deleteAttributesFromRole (id: string, ...attrName: (keyof dbLib.RoleEntity)[]): Promise<mongodb.WriteOpResult> {
    return super.deleteAttributesFromItem<dbLib.RoleEntity>(id, attrName)
  }

  public updateRole (id: string, updateRole: dbLib.RoleEntity): Promise<mongodb.WriteOpResult> {
    return super.updateItemByObjectId<dbLib.RoleEntity>(id, updateRole)
  }

  public applyHydrateFieldsForAttrNames (attrNames: (keyof dbLib.RoleEntity)[]): (keyof dbLib.RoleEntity)[] {
    if (!attrNames) {
      return attrNames
    }

    if (_.includes<keyof dbLib.RoleEntity>(attrNames, 'person')) {
      attrNames.push('personId')
    }
    return _.uniq(attrNames)
  }

  public async applyHydrateFields (roles: dbLib.RoleEntity[]): Promise<dbLib.RoleEntity[]> {
    if (!this.useHydrateFields) {
      return roles
    }

    let dbMngr = await mongoDbLib.MongoDBManager.instance
    let tblPplName = MongoDbConfig.tableNames.PERSON_TABLE_NAME
    let tblPpl = dbMngr.getTable<mongoDbLib.PersonTable>(tblPplName)
    if (_.includes<dbLib.RoleEntityHydrateField>(this.hydrateFields, 'person')) {
      let pplIdx = _.uniq(_.filter(_.map(roles, x => x.personId), _.identity))
      let pplItems = _.keyBy(await tblPpl.getPersonsById(pplIdx), 'id')
      _.each(roles, r => r.personId && (r.person = pplItems[r.personId]))
      // console.log(`[RoleTable::applyHydrateFields()] Hydrated persons = ${JSON.stringify(pplItems, null, 2)}`)
      // console.log(`[RoleTable::applyHydrateFields()] Hydrated person idx = ${JSON.stringify(pplIdx, null, 2)}`)
    }
    return roles
  }
}
