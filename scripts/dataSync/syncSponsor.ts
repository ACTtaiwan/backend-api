import * as dbLib from '../../libs/dbLib'
import { CongressGovHelper } from '../../libs/congressGov/CongressGovHelper'
import { CongressGovSponsorParser } from '../../libs/congressGov/CongressGovSponsorParser'
import * as models from '../../libs/congressGov/CongressGovModels'
import * as _ from 'lodash'
import { CongressGovAllInfoParser } from '../../libs/congressGov/CongressGovAllInfoParser';
import { RoleManager } from '../../libs/dataManager/RoleManager';
import * as mongoDbLib from '../../libs/mongodbLib'
import { MongoDbConfig } from '../../config/mongodb'

var awsConfig = require('../../config/aws.json');

/**
 *  sync for sponsors & co-sponsors
 */
export class SponsorSync {
  private readonly roleManager = new RoleManager()
  private tblBill: mongoDbLib.BillTable

  private readonly congressGovSponsorParser = new CongressGovSponsorParser()
  private readonly congressGovAllInfoParser = new CongressGovAllInfoParser()

  private roleMapSearchId = (bioGuideId: string, chamber: models.ChamberType) => bioGuideId + '-' + chamber

  public get billTable (): mongoDbLib.BillTable {
    return this.tblBill
  }

  public async init (): Promise<void> {
    if (!this.tblBill) {
      await this.roleManager.init()
      let db = await mongoDbLib.MongoDBManager.instance
      const tblBillName = MongoDbConfig.tableNames.BILLS_TABLE_NAME
      this.tblBill = db.getTable(tblBillName)
    }
    return Promise.resolve()
  }

  public async syncSponsorForAllBills (
    currentCongress: number,
    minUpdateCongress: number = CongressGovHelper.MIN_CONGRESS_DATA_AVAILABLE,
    maxUpdateCongress: number = currentCongress
  ) {
    let bills = await this.tblBill.getAllBills('id', 'congress', 'billType', 'billNumber', 'sponsor', 'cosponsors', 'introducedDate')

    // filter out bills whose data is not available at congress.gov
    const minCongress = Math.max(CongressGovHelper.MIN_CONGRESS_DATA_AVAILABLE, minUpdateCongress)
    const maxCongress = Math.min(currentCongress, maxUpdateCongress)
    bills = _.filter(bills, x => x.congress >= minCongress && x.congress <= maxCongress)

    // build congress <--> bills map
    const congressBillsMap = _.groupBy(bills, 'congress')
    const keys = _.keys(congressBillsMap)
    for (let c = 0; c < keys.length; ++c) {
      let congress = parseInt(keys[c])
      let bills = congressBillsMap[congress]
      console.log(`Updating congress = ${congress}`)
      await this.batchSyncForCongress(congress, bills, currentCongress)
      console.log('\n\n\n')
    }
  }

  public async batchSyncForCongress (congress: number, bills: dbLib.BillEntity[], currentCongress: number, writeToDb: boolean = true) {
    const roleMap = await this.buildRoleMapOfCongress(congress)

    let queryRole = (sponsor: models.CongressGovSponsor, bill: dbLib.BillEntity, cosponsorDate?: number) => {
      const billDisplay = dbLib.DbHelper.displayBill(bill)
      const roleMapId = sponsor.bioGuideId
                     && bill.billType
                     && bill.billType.chamber
                     && this.roleMapSearchId(sponsor.bioGuideId, bill.billType.chamber)
      const roles = roleMapId && roleMap[roleMapId]
      if (roles) {
        if (roles.length === 1) {
          console.log(`${billDisplay} --> ${sponsor.bioGuideId} ${sponsor.name} found role entity. updating...`)
          return roles[0]
        } else {
          let date = cosponsorDate || bill.introducedDate
          if (date) {
            const resolvedRole = _.filter(roles, r => date >= r.startDate && date <= r.endDate)
            if (resolvedRole && resolvedRole.length === 1) {
              return resolvedRole[0]
            } else {
              throw new Error(`Found conflict roles (date ${date} resolved failed) = ${JSON.stringify(roles, null, 2)}`)
            }
          } else {
            throw new Error(`Found conflict roles (no date used to resolve) = ${JSON.stringify(roles, null, 2)}`)
          }
        }
      } else {
        throw new Error(`${billDisplay} --> ${sponsor.bioGuideId} ${sponsor.name} NOT found role entity.`)
      }
    }

    for (let i = 0; i < bills.length; ++i) {
      const bill = bills[i]
      const path = CongressGovHelper.generateCongressGovBillPath(bill.congress, bill.billType.code, bill.billNumber)
      const billDisplay = dbLib.DbHelper.displayBill(bill)

      console.log(`\n${billDisplay} -- Updating sponsor --\n`)

      const sponsor = await this.congressGovSponsorParser.getSponsorBioGuideId(path)
      const role = await queryRole(sponsor, bill)
      writeToDb && (await this.tblBill.updateSponsor(bill.id, role))

      console.log(`\n${billDisplay} -- Updating co-sponsors --\n`)
      const allInfo = await this.congressGovAllInfoParser.getAllInfo(path)
      const cosponsorEntities: dbLib.CosponsorEntity[] = []
      for (let j = 0; j < allInfo.cosponsors.length; ++j) {
        const item = allInfo.cosponsors[j]
        const entity = <dbLib.CosponsorEntity> {}

        if (item.dateCosponsored) {
          entity.dateCosponsored = item.dateCosponsored
        }

        const cosponsorRole = await queryRole(item.cosponsor, bill, item.dateCosponsored)
        if (cosponsorRole) {
          entity.role = cosponsorRole
        }

        if (!_.isEmpty(entity)) {
          cosponsorEntities.push(entity)
        }
      }
      writeToDb && (await this.tblBill.updateCoSponsors(bill.id, cosponsorEntities))

      console.log('\n\n')
    }

  }

  private async buildRoleMapOfCongress (congress: number): Promise<{[bioGuideId: string]: dbLib.RoleEntity[]}> {
    let roles = await this.roleManager.getRolesByCongress(congress)
    let roleMap: {[bioGuideId: string]: dbLib.RoleEntity[]} = {}
    _.each(roles, role => {
      if (role.person && role.person.bioGuideId) {
        const roleDisplay = role.roleTypeDisplay.toLocaleLowerCase()
        let chamber: models.ChamberType
        if (roleDisplay.startsWith('sen')) {
          chamber = 'senate'
        } else if (roleDisplay.startsWith('rep')) {
          chamber = 'house'
        } else {
          throw new Error(`Unrecognized roleTypeDisplay = ${roleDisplay}`)
        }

        const id = this.roleMapSearchId(role.person.bioGuideId, chamber)
        if (roleMap[id]) {
          roleMap[id].push(role)
        } else {
          roleMap[id] = [role]
        }
      }
    })
    console.log(`Congress ${congress} found ${roles.length} sponsors`)
    return roleMap
  }
}

let sync = new SponsorSync()
// sync.syncSponsorForAllBills(115)

let patch = async (billId: string, currentCongress = 115) => {
  await sync.init()
  const bill = await sync.billTable.getBillById(billId)
  await sync.batchSyncForCongress(bill.congress, [bill], currentCongress, /* writeToDb */ true)
}

patch('df717157-4d7b-4a55-acf4-eae451f2ff64')