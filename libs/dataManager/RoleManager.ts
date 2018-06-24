import * as dbLib from '../../libs/dbLib'
import * as _ from 'lodash'
import { CongressGovHelper } from '../congressGov/CongressGovHelper';

var awsConfig = require('../../config/aws.json');

export class RoleManager {
  private readonly db = dbLib.DynamoDBManager.instance()

  private readonly tblBillName = (<any> awsConfig).dynamodb.VOLUNTEER_BILLS_TABLE_NAME
  public  readonly tblBill = <dbLib.BillTable> this.db.getTable(this.tblBillName)

  private readonly tblRoleName = (<any> awsConfig).dynamodb.VOLUNTEER_ROLES_TABLE_NAME
  public  readonly tblRole = <dbLib.RoleTable> this.db.getTable(this.tblRoleName)

  private readonly tblPplName = (<any> awsConfig).dynamodb.VOLUNTEER_PERSON_TABLE_NAME
  private readonly tblPpl = <dbLib.PersonTable> this.db.getTable(this.tblPplName)

  private readonly tblCngrName = (<any> awsConfig).dynamodb.VOLUNTEER_CONGRESS_TABLE_NAME
  public  readonly tblCngr = <dbLib.CongressTable> this.db.getTable(this.tblCngrName)

  private _tblRoleSponsors: {[roldId: string]: dbLib.RoleEntity}
  private _tblRoleCosponsors: {[roleId: string]: dbLib.RoleEntity}

  public async rebuildBillIndex (cleanup: boolean = false) {
    if (cleanup) {
      await this.resetBillsForRoleTable()
    }

    const bills = await this.tblBill.getAllBills('id', 'congress', 'billNumber', 'billType', 'sponsor', 'cosponsors')

    const billsWithSponsors = <dbLib.BillEntity[]> _.filter(bills, (b => b.sponsor));
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

  public async rebuildCongressIndex (cleanup: boolean = false): Promise<void> {
    if (cleanup) {
      console.log(`\n---------------------------------- Clean up role id on congress table ----------------------------------\n`)
      for (let c = 1; c <= CongressGovHelper.CURRENT_CONGRESS; ++c) {
        await this.tblCngr.removeAllRolesFromCongress(c)
      }
    }

    console.log(`\n---------------------------------- Rebuilding congress <--> roleId[] map ----------------------------------\n`)
    let cngrRoleMap: {[congress: number]: string[]} = {}
    await this.tblRole.forEachBatchOfAllRoles(async roles => {
      console.log(`[RoleManager::rebuildCongressIndex()] Batch role size = ${roles.length}`)
      _.each(roles, r => {
        if (r.congressNumbers && r.congressNumbers.length > 0) {
          _.each(r.congressNumbers, c => cngrRoleMap[c] ? cngrRoleMap[c].push(r.id) : cngrRoleMap[c] = [r.id])
        }
      })
    }, ['id', 'congressNumbers'])

    console.log(`\n---------------------------------- Writing role id on congress table ----------------------------------\n`)
    _.each(cngrRoleMap, (val, key) => cngrRoleMap[key] = _.uniq(val))
    for (let key of _.keys(cngrRoleMap)) {
      let congress = parseInt(key)
      let roleIdx = cngrRoleMap[congress]
      console.log(`[RoleManager::rebuildCongressIndex()] congress = ${congress} roles = ${roleIdx.length}`)
      await this.tblCngr.addRoleIdArrayToCongress(congress, roleIdx)
    }
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

  public getRolesByPersonId (personId: string[], ...attrNamesToGet: (keyof dbLib.RoleEntity)[] ): Promise<dbLib.RoleEntity[]> {
    if (personId) {
      if (personId.length === 1) {
        return this.tblRole.getRolesByPersonId(personId[0])
      } else {
        let promises: Promise<dbLib.RoleEntity[]>[] = []
        _.each(personId, pid => promises.push(this.tblRole.getRolesByPersonId(pid)))
        return Promise.all(promises).then(results => {
          let roles = _.keyBy(_.flatten(results), 'id')
          return _.values(roles)
        })
      }
    }
    return Promise.resolve([])
  }

  public getRolesByCongress (congress: number, ...attrNamesToGet: (keyof dbLib.RoleEntity)[]): Promise<dbLib.RoleEntity[]> {
    return this.tblCngr.getRoleIdxByCongress(congress).then(
      roleIdx => this.getRolesById(roleIdx, ...attrNamesToGet))
  }

  public getRolesByState (state: string, congress?: number, attrNamesToGet?: (keyof dbLib.RoleEntity)[]): Promise<dbLib.RoleEntity[]> {
    return this.tblRole.getRolesByState(state, attrNamesToGet, congress)
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

