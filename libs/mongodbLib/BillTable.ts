import * as mongodb from 'mongodb'
import * as models from '../congressGov/CongressGovModels'
import { MongoDBTable } from './'
import { MongoDbConfig } from '../../config/mongodb'
import * as dbLib from '../dbLib'
import * as _ from 'lodash'
import * as mongoDbLib from './';

export class BillTable extends MongoDBTable<dbLib.BillEntityHydrateField> {
  public readonly tableName = MongoDbConfig.tableNames.BILLS_TABLE_NAME
  protected readonly suggestPageSize: number = 100

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
    let tagEntity: dbLib.BillTagEntityMongoDB = { tag, userVote }
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
    return super.getAllItems<dbLib.BillEntity>(this.applyHydrateFieldsForAttrNames(attrNamesToGet))
      .then(items => this.applyHydrateFields(items))
  }

  public queryBillsByCongress (congress: number, attrNamesToGet?: (keyof dbLib.BillEntity)[]): Promise<dbLib.BillEntity[]> {
    return super.queryItems<dbLib.BillEntity>({ congress }, this.applyHydrateFieldsForAttrNames(attrNamesToGet))
      .then(items => this.applyHydrateFields(items))
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
      let rolesMap = _.keyBy(await tblRole.getRolesById(roleIdx), '_id')
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
