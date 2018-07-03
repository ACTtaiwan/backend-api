import * as dbLib from '../../libs/dbLib'
import * as _ from 'lodash'
import { CongressGovHelper } from '../congressGov/CongressGovHelper';
import * as mongoDbLib from '../../libs/mongodbLib'
import { MongoDbConfig } from '../../config/mongodb'

var awsConfig = require('../../config/aws.json');

export class RoleManager {
  private tblBill: mongoDbLib.BillTable
  private tblRole: mongoDbLib.RoleTable
  private tblPpl: mongoDbLib.PersonTable

  private _tblRoleSponsors: {[roldId: string]: dbLib.RoleEntity}
  private _tblRoleCosponsors: {[roleId: string]: dbLib.RoleEntity}

  public async init (): Promise<void> {
    if (!this.tblBill || !this.tblRole || !this.tblPpl) {
      let db = await mongoDbLib.MongoDBManager.instance

      const tblBillName = MongoDbConfig.tableNames.BILLS_TABLE_NAME
      this.tblBill = db.getTable(tblBillName)

      const tblRoleName = MongoDbConfig.tableNames.ROLES_TABLE_NAME
      this.tblRole = db.getTable(tblRoleName)

      const tblPplName = MongoDbConfig.tableNames.PERSON_TABLE_NAME
      this.tblPpl = db.getTable(tblPplName)
    }
    return Promise.resolve()
  }

  public async rebuildBillIndex (cleanup: boolean = false) {
    if (cleanup) {
      await this.resetBillsForRoleTable()
    }

    const bills = await this.tblBill.getAllBills('id', 'congress', 'billNumber', 'billType', 'sponsor', 'cosponsors')

    const billsWithSponsors = _.filter(bills, (b => !!b.sponsor));
    await this.syncSponsors(billsWithSponsors)

    const billsWithCosonsors = _.filter(bills, b => b.cosponsors && b.cosponsors.length > 0)
    await this.syncCosponsors(billsWithCosonsors)
  }

  public async resetBillsForRoleTable () {
    let clean = async (roles: dbLib.RoleEntity[]) => {
      for (let c = 0; c < roles.length; ++c) {
        await this.tblRole.removeAllBillsFromRole(roles[c].id)
      }
    }

    console.log(`\n---------------------------------- Clean up Sponsors ----------------------------------\n`)
    clean(_.values(await this.getRolesSponsored()))

    console.log(`\n---------------------------------- Clean up Co-Sponsors -------------------------------\n`)
    clean(_.values(await this.getRolesCosponsored()))
  }

  public getRolesById (id: string[], ...attrNamesToGet: (keyof dbLib.RoleEntity)[] ): Promise<dbLib.RoleEntity[]> {
    if (id) {
      if (id.length === 1) {
        return this.tblRole.getRoleById(id[0], ...attrNamesToGet).then(role => [role])
      } else {
        return this.tblRole.getRolesById(id, ...attrNamesToGet)
      }
    }
    return Promise.resolve([])
  }

  public getRolesByPersonId (personId: string | string[], ...attrNamesToGet: (keyof dbLib.RoleEntity)[] ): Promise<dbLib.RoleEntity[]> {
    return this.tblRole.queryRoles(personId, null, null, attrNamesToGet)
  }

  public getRolesByCongress (congress: number | number[], ...attrNamesToGet: (keyof dbLib.RoleEntity)[] ): Promise<dbLib.RoleEntity[]> {
    return this.tblRole.queryRoles(null, null, congress, attrNamesToGet)
  }

  public getRolesByState (state: string | string[], ...attrNamesToGet: (keyof dbLib.RoleEntity)[] ): Promise<dbLib.RoleEntity[]> {
    return this.tblRole.queryRoles(null, state, null, attrNamesToGet)
  }

  public getRoleByStatesAndCongress (state: string | string[], congress: number | number[], ...attrNamesToGet: (keyof dbLib.RoleEntity)[] ): Promise<dbLib.RoleEntity[]> {
    return this.tblRole.queryRoles(null, state, congress, attrNamesToGet)
  }

  public getRolesByBioGuideId (bioGuideId: string): Promise<dbLib.RoleEntity[]> {
    return this.tblPpl.getPersonByBioGuideId(bioGuideId).then(person => {
      if (person) {
        let backupHydrate = this.tblRole.useHydrateFields
        this.tblRole.useHydrateFields = false // don't hydrate person field
        return this.tblRole.getRolesByPersonId(person.id).then(roles => {
          _.each(roles, r => r.person = person)
          this.tblRole.useHydrateFields = backupHydrate
          return roles
        })
      }
      return null
    })
  }

  private async syncSponsors (billsWithSponsors: dbLib.BillEntity[]) {
    const sponsorBillMap: {[roleId: string]: dbLib.BillEntity[]} = _.groupBy(billsWithSponsors, x => x.sponsor.id)
    const rolesSponsored: {[roleId: string]: dbLib.RoleEntity} = await this.getRolesSponsored()

    let intersectSet = _.intersection(_.keys(sponsorBillMap), _.keys(rolesSponsored))
    let addSet = _.difference(_.keys(sponsorBillMap), intersectSet)
    let deleteSet = _.difference(_.keys(rolesSponsored), intersectSet)
    let updateSet = _.filter(intersectSet, roleId => {
      const billIdOnBillTbl = _.map(sponsorBillMap[roleId], x => x.id)
      const billIdOnRoleTbl = rolesSponsored[roleId].billIdSponsored
      return !_.isEqual(billIdOnBillTbl.sort(), billIdOnRoleTbl.sort())
    })

    console.log(`[RoleManager::syncSponsors()] intersectSet.length = ${intersectSet.length}`)
    console.log(`[RoleManager::syncSponsors()] addSet.length = ${addSet.length}`)
    console.log(`[RoleManager::syncSponsors()] deleteSet.length = ${deleteSet.length}`)
    console.log(`[RoleManager::syncSponsors()] updateSet.length = ${updateSet.length}`)

    for (let b = 0; b < updateSet.length; ++b) {
      const roleId = updateSet[b]
      const bills = sponsorBillMap[roleId]
      const billIdx = _.map(bills, bill => bill.id)
      const billDisplay = _.map(bills, bill => dbLib.DbHelper.displayBill(bill)).join('\n')
      console.log(`\n--------------------- Updating bills for Sponsor ${roleId} (${b} / ${updateSet.length}) ---------------------\n`)
      console.log(billDisplay)
      await this.tblRole.setBillIdArrayToRole(roleId, billIdx, 'sponsor')
    }

    for (let b = 0; b < addSet.length; ++b) {
      const roleId = addSet[b]
      const bills = sponsorBillMap[roleId]
      const billIdx = _.map(bills, bill => bill.id)
      const billDisplay = _.map(bills, bill => dbLib.DbHelper.displayBill(bill)).join('\n')
      console.log(`\n--------------------- Adding bills for Sponsor ${roleId} (${b} / ${addSet.length}) ---------------------\n`)
      console.log(billDisplay)
      await this.tblRole.setBillIdArrayToRole(roleId, billIdx, 'sponsor')
    }

    for (let b = 0; b < deleteSet.length; ++b) {
      const roleId = deleteSet[b]
      console.log(`\n--------------------- Deleting bills for Sponsor ${roleId} (${b} / ${deleteSet.length}) ---------------------\n`)
      await this.tblRole.removeAllBillsFromRole(roleId, 'sponsor')
    }
  }

  private async syncCosponsors (billsWithCosonsors: dbLib.BillEntity[]) {
    const cosponsorBillMap: {[roleId: string]: dbLib.BillEntity[]} = {}
    _.each(billsWithCosonsors, bill => {
      _.each(bill.cosponsors, co => {
        let arr: dbLib.BillEntity[] = cosponsorBillMap[co.role.id] || []
        !_.find(arr, x => x.id === bill.id) && arr.push(bill)
        cosponsorBillMap[co.role.id] = arr
      })
    })
    const rolesCosponsored: {[roleId: string]: dbLib.RoleEntity} = await this.getRolesCosponsored()

    let intersectSet = _.intersection(_.keys(cosponsorBillMap), _.keys(rolesCosponsored))
    let addSet = _.difference(_.keys(cosponsorBillMap), intersectSet)
    let deleteSet = _.difference(_.keys(rolesCosponsored), intersectSet)
    let updateSet = _.filter(intersectSet, roleId => {
      const billIdOnBillTbl = _.map(cosponsorBillMap[roleId], x => x.id)
      const billIdOnRoleTbl = rolesCosponsored[roleId].billIdCosponsored
      return !_.isEqual(billIdOnBillTbl.sort(), billIdOnRoleTbl.sort())
    })

    console.log(`[RoleManager::syncCosponsors()] intersectSet.length = ${intersectSet.length}`)
    console.log(`[RoleManager::syncCosponsors()] addSet.length = ${addSet.length}`)
    console.log(`[RoleManager::syncCosponsors()] deleteSet.length = ${deleteSet.length}`)
    console.log(`[RoleManager::syncCosponsors()] updateSet.length = ${updateSet.length}`)

    for (let b = 0; b < updateSet.length; ++b) {
      const roleId = updateSet[b]
      const bills = cosponsorBillMap[roleId]
      const billIdx = _.map(bills, bill => bill.id)
      const billDisplay = _.map(bills, bill => dbLib.DbHelper.displayBill(bill)).join('\n')
      console.log(`\n--------------------- Updating bills for Co-Sponsor ${roleId} (${b} / ${updateSet.length}) ---------------------\n`)
      console.log(billDisplay)
      await this.tblRole.setBillIdArrayToRole(roleId, billIdx, 'cosponsor')
    }

    for (let b = 0; b < addSet.length; ++b) {
      const roleId = addSet[b]
      const bills = cosponsorBillMap[roleId]
      const billIdx = _.map(bills, bill => bill.id)
      const billDisplay = _.map(bills, bill => dbLib.DbHelper.displayBill(bill)).join('\n')
      console.log(`\n--------------------- Adding bills for Co-Sponsor ${roleId} (${b} / ${addSet.length}) ---------------------\n`)
      console.log(billDisplay)
      await this.tblRole.setBillIdArrayToRole(roleId, billIdx, 'cosponsor')
    }

    for (let b = 0; b < deleteSet.length; ++b) {
      const roleId = deleteSet[b]
      console.log(`\n--------------------- Deleting bills for Sponsor ${roleId} (${b} / ${deleteSet.length}) ---------------------\n`)
      await this.tblRole.removeAllBillsFromRole(roleId, 'cosponsor')
    }
  }

  private async getRolesSponsored (): Promise<{[roleId: string]: dbLib.RoleEntity}> {
    if (!this._tblRoleSponsors) {
      const roles = await this.tblRole.getRolesHavingSponsoredBills('sponsor')
      this._tblRoleSponsors = _.keyBy(roles, 'id')
    }
    return Promise.resolve(this._tblRoleSponsors)
  }

  private async getRolesCosponsored (): Promise<{[roleId: string]: dbLib.RoleEntity}> {
    if (!this._tblRoleCosponsors) {
      const roles = await this.tblRole.getRolesHavingSponsoredBills('cosponsor')
      this._tblRoleCosponsors = _.keyBy(roles, 'id')
    }
    return Promise.resolve(this._tblRoleCosponsors)
  }
}

