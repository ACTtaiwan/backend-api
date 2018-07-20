import * as mongodb from 'mongodb'
import * as models from '../congressGov/CongressGovModels'
import { MongoDBTable } from './'
import { MongoDbConfig } from '../../config/mongodb'
import * as dbLib from '../dbLib'
import * as _ from 'lodash'
import * as mongoDbLib from './';
import { CongressGovHelper } from '../congressGov/CongressGovHelper';

export class BillTable extends MongoDBTable<dbLib.BillEntityHydrateField> {
  public readonly tableName = MongoDbConfig.tableNames.BILLS_TABLE_NAME
  protected readonly suggestPageSize: number = 100

  public static readonly MAX_SEARCH_TOKENS = 5

  constructor (db: mongodb.Db) {
    super(db)
    this.hydrateFields = ['sponsor', 'cosponsors']
  }

  public putBill (obj: dbLib.BillEntity): Promise<dbLib.BillEntity> {
    return super.putItem(obj)
  }

  public createEmptyTagsAttrForBill (billId: string): Promise<mongodb.WriteOpResult> {
    return super.updateItemByObjectId<dbLib.BillEntity>(billId, { tags: [] })
  }

  public addTagToBill (tag: string, billId: string, userVote: dbLib.BillTagUserVote = {}): Promise<mongodb.WriteOpResult> {
    let tagEntity: dbLib.BillTagEntityMongoDB = { name: tag, userVote: userVote }
    return super.getTable<dbLib.BillTable>().update(
      {
        _id: billId,
        tags: { $not: { $elemMatch: { tag } } }
      },
      { $push: { tags: tagEntity } },
      { upsert: true }
    ).catch(err => {
      if (err && err.code && err.code === 11000) {
        console.log(`[BillTable::addTagToBill()] Tag = '${tag}' already exists. Skip adding tag.`)
        return null
      } else {
        throw err
      }
    })
  }

  public getBillById (id: string, ...attrNamesToGet: (keyof dbLib.BillEntity)[]): Promise<dbLib.BillEntity> {
    return super.getItem<dbLib.BillEntity>('_id', id, this.applyHydrateFieldsForAttrNames(attrNamesToGet))
      .then(async data => data ? (await this.applyHydrateFields([data]))[0] : null)
  }

  public getBillsById (idx: string[], ...attrNamesToGet: (keyof dbLib.BillEntity)[]): Promise<dbLib.BillEntity[]> {
    return super.getItems<dbLib.BillEntity>('_id', idx, this.applyHydrateFieldsForAttrNames(attrNamesToGet))
      .then(items => this.applyHydrateFields(items))
  }

  public getBill (congress: number,
                  billTypeCode: models.BillTypeCode,
                  billNumber: number,
                  ...attrNamesToGet: (keyof dbLib.BillEntity)[]): Promise<dbLib.BillEntity> {
    return this.getBillWithFlexibleType(congress, ['code', billTypeCode], billNumber, ...attrNamesToGet)
  }

  public getBillWithFlexibleType (congress: number,
                                  billTypeQuery: [keyof dbLib.BillTypeEntity, any],
                                  billNumber: number,
                                  ...attrNamesToGet: (keyof dbLib.BillEntity)[]): Promise<dbLib.BillEntity> {
    let billTypeKey = billTypeQuery[0]
    let billTypeVal = billTypeQuery[1]
    let query = { congress, billNumber }
    query[`billType.${billTypeKey}`] = billTypeVal
    return this.queryItemOne<dbLib.BillEntity>(query, this.applyHydrateFieldsForAttrNames(attrNamesToGet))
      .then(async data => data ? (await this.applyHydrateFields([data]))[0] : null)
  }

  public getAllBillsHavingAttributes (keys: (keyof dbLib.BillEntity)[], ...attrNamesToGet: (keyof dbLib.BillEntity)[]): Promise<dbLib.BillEntity[]> {
    return super.getItemsHavingAttributes<dbLib.BillEntity>(keys, ...this.applyHydrateFieldsForAttrNames(attrNamesToGet)).then(
      data => this.applyHydrateFields(data))
  }

  public getAllBillsNotHavingAttributes (keys: (keyof dbLib.BillEntity)[], ...attrNamesToGet: (keyof dbLib.BillEntity)[]): Promise<dbLib.BillEntity[]> {
    return super.getItemsNotHavingAttributes<dbLib.BillEntity>(keys, ...this.applyHydrateFieldsForAttrNames(attrNamesToGet)).then(
      data => this.applyHydrateFields(data))
  }

  public async forEachBatchOfAllBills (
    callback: (batchBills: dbLib.BillEntity[], lastKey?: string) => Promise<boolean | void>,
    attrNamesToGet?: (keyof dbLib.BillEntity)[]
  ) {
    return super.forEachBatch<dbLib.BillEntity>(callback, this.applyHydrateFieldsForAttrNames(attrNamesToGet))
  }

  public getAllBills (...attrNamesToGet: (keyof dbLib.BillEntity)[]): Promise<dbLib.BillEntity[]> {
    // return super.getAllItems<dbLib.BillEntity>(this.applyHydrateFieldsForAttrNames(attrNamesToGet))
    //   .then(items => this.applyHydrateFields(items))
    return super.queryItems<dbLib.BillEntity>({}, this.applyHydrateFieldsForAttrNames(attrNamesToGet))
      .then(items => this.applyHydrateFields(items))
  }

  public getBillsByMongoQuery (query: {}, attrNamesToGet?: (keyof dbLib.BillEntity)[]): Promise<dbLib.BillEntity[]> {
    return super.queryItems<dbLib.BillEntity>(query, this.applyHydrateFieldsForAttrNames(attrNamesToGet))
      .then(items => this.applyHydrateFields(items))
  }

  public queryBillsByCongress (congress: number, attrNamesToGet?: (keyof dbLib.BillEntity)[]): Promise<dbLib.BillEntity[]> {
    return super.queryItems<dbLib.BillEntity>({ congress }, this.applyHydrateFieldsForAttrNames(attrNamesToGet))
      .then(items => this.applyHydrateFields(items))
  }

  public searchBills (
    q: string,
    attrNamesToGet?: (keyof dbLib.BillEntity)[],
    maxSearchItems?: number,
    congress?: number[]
  ): Promise<dbLib.BillEntity[]> {

    q = q.toLowerCase()

    let billTypeCodes = _.keys(CongressGovHelper.typeCodeToFullTypeNameMap)
    let billTypeFirstMatch = _.filter(billTypeCodes, code => q.includes(code))[0] || ''
    let numberMatch = q.match(/^\d+|\d+\b|\d+(?=\w)/g)
    let numberFirstMatch = (numberMatch && numberMatch[0] && parseInt(numberMatch[0])) || undefined

    let query = {}

    if (billTypeFirstMatch) {
      query['billType.code'] = billTypeFirstMatch
      q = q.replace(billTypeFirstMatch, '')
    }

    if (numberFirstMatch) {
      query['billNumber'] = numberFirstMatch
      q = q.replace(numberFirstMatch.toString(), '')
    }

    if (congress) {
      if (congress.length === 1 && congress[0]) {
        query['congress'] = congress[0]
      } else {
        query['congress'] = { $in: congress }
      }
    }

    let tokens = (q.match(/\S+/g) || []).slice(0, BillTable.MAX_SEARCH_TOKENS);
    if (tokens && tokens.length > 0) {
      let conditions: {[key in keyof dbLib.BillEntity]?: any}[] = []
      _.each(tokens, token =>  {
        let regExp = new RegExp(token, 'ig')
        conditions.push({ 'title':    { $regex: regExp } })
        conditions.push({ 'title_zh': { $regex: regExp } })
      })

      if (conditions.length > 0) {
        query['$or'] = conditions
      }
    }

    console.log('[BillTable::searchBills()] q = ' + q)
    console.log('[BillTable::searchBills()] tokens = ' + tokens)
    console.log(`[BillTable::searchBills()] query = ${JSON.stringify(query, null, 2)}`)

    let queryItems = (query) => {
      let hydratedAttrNames = this.applyHydrateFieldsForAttrNames(attrNamesToGet)
      let prjFields = this.composeProjectFields<dbLib.BillEntity>(hydratedAttrNames)
      let cursor = this.getTable<dbLib.BillEntity>().find(query, prjFields)
      if (maxSearchItems && maxSearchItems > 0) {
        cursor = cursor.limit(maxSearchItems)
      }
      return cursor.toArray()
        .then(items => super.addBackIdField(items))
        .then(items => this.applyHydrateFields(items))
    }

    const perfMark = '[BillTable::searchBills()] search time'
    console['time'](perfMark)
    return queryItems(query)
      .then(items => {
        console['timeEnd'](perfMark)
        return items
      })
  }

  public deleteBills (idx: string[]): Promise<mongodb.DeleteWriteOpResultObject> {
    return (idx && idx.length > 0) ? super.deleteItems(idx) : Promise.resolve(null)
  }

  public deleteAttributesFromBill (id: string, ...attrName: (keyof dbLib.BillEntity)[]): Promise<mongodb.WriteOpResult> {
    return super.deleteAttributesFromItem<dbLib.BillEntity>(id, attrName)
  }

  public deleteTagFromBill (billId: string, tag: string): Promise<mongodb.WriteOpResult> {
    return super.getTable<dbLib.BillTable>().update(
      { _id: billId },
      { $pull: { tags: { tag } } },
      { multi: true }
    )
  }

  public addBills (bills: dbLib.BillEntity[]): Promise<mongodb.InsertWriteOpResult> {
    return super.addItems(bills);
  }

  public updateBill (id: string, updateBill: dbLib.BillEntity): Promise<mongodb.WriteOpResult> {
    return super.updateItemByObjectId<dbLib.BillEntity>(id, updateBill)
  }

  public updateTracker (id: string, val: models.Tracker[]): Promise<mongodb.WriteOpResult> {
    return super.updateItemByObjectId<dbLib.BillEntity>(id, {'trackers': val})
  }

  public updateSponsor (id: string, val: dbLib.RoleEntity): Promise<mongodb.WriteOpResult> {
    return super.updateItemByObjectId<dbLib.BillEntity>(id, {'sponsor': val})
  }

  public updateCoSponsors (id: string, val: dbLib.CosponsorEntity[]): Promise<mongodb.WriteOpResult> {
    return super.updateItemByObjectId<dbLib.BillEntity>(id, {'cosponsors': val})
  }

  public updateIntroducedDate (id: string, val: number): Promise<mongodb.WriteOpResult> {
    return super.updateItemByObjectId<dbLib.BillEntity>(id, {'introducedDate': val})
  }

  public updateTagUserCount (tag: string, billId: string, userId: string, count: number): Promise<mongodb.WriteOpResult> {
    let setter = {}
    setter[`tags.$.userVote.${userId}`] = count
    return super.getTable<dbLib.BillTable>().update(
        {
          _id: billId,
          tags: { $elemMatch: {tag} }
        },
        { $set: setter },
        { upsert: true }
      ).catch(err => {
        if (err && err.code && err.code === 16836) {
          console.log(`[BillTable::updateTagUserCount()] {tag='${tag}', billId='${billId}'} not found. Skip update.`)
          return null
        } else {
          throw err
        }
      })
  }

  public clearTagUserCount (tag: string, billId: string): Promise<mongodb.WriteOpResult> {
    return super.getTable<dbLib.BillTable>().update(
      {
        _id: billId,
        tags: { $elemMatch: {tag} }
      },
      { $set: { 'tags.$.userVote': {}} },
      { upsert: true }
    ).catch(err => {
      if (err && err.code && err.code === 16836) {
        console.log(`[BillTable::clearTagUserCount()] {tag='${tag}', billId='${billId}'} not found. Skip clear.`)
        return null
      } else {
        throw err
      }
    })
  }

  public applyHydrateFieldsForAttrNames (attrNames: (keyof dbLib.BillEntity)[]): (keyof dbLib.BillEntity)[] {
    if (!attrNames) {
      return attrNames
    }

    if (_.includes<keyof dbLib.BillEntity>(attrNames, 'sponsor')) {
      attrNames.push('sponsorRoleId')
    }
    return _.uniq(attrNames)
  }

  public async applyHydrateFields (bills: dbLib.BillEntity[]): Promise<dbLib.BillEntity[]> {
    if (!this.useHydrateFields || !bills || _.isEmpty(bills)) {
      return bills
    }

    let dbMngr = await mongoDbLib.MongoDBManager.instance
    let tblRoleName = MongoDbConfig.tableNames.ROLES_TABLE_NAME
    let tblRole = dbMngr.getTable<mongoDbLib.RoleTable>(tblRoleName)

    let hydrateSponsor = _.includes<dbLib.BillEntityHydrateField>(this.hydrateFields, 'sponsor')
    let hydrateCosponsor = _.includes<dbLib.BillEntityHydrateField>(this.hydrateFields, 'cosponsors')

    let roleIdx: string[] = []

    if (hydrateSponsor) {
      roleIdx = roleIdx.concat(_.filter(_.map(bills, x => x.sponsorRoleId), _.identity))
    }

    if (hydrateCosponsor) {
      _.each(bills, b => {
        if (b.cosponsors && b.cosponsors.length > 0) {
          roleIdx = roleIdx.concat(_.filter(_.map(b.cosponsors, x => x.roleId), _.identity))
        }
      })
    }

    roleIdx = _.uniq(roleIdx)
    // console.log(`[BillTable::applyHydrateFields()] roleIdx = ${JSON.stringify(roleIdx, null, 2)}`)

    if (roleIdx.length > 0) {
      let rolesMap = _.keyBy(await tblRole.getRolesById(roleIdx), 'id')
      _.each(bills, b => {
        if (hydrateSponsor) {
          b.sponsor = rolesMap[b.sponsorRoleId]
        }
        if (hydrateCosponsor) {
          _.each(b.cosponsors, co => co.role = rolesMap[co.roleId])
        }
      })
      // console.log(`[BillTable::applyHydrateFields()] post-hydrated: ${JSON.stringify(bills, null, 2)}`)
    }
    return bills
  }
}
