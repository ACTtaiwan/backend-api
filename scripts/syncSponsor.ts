import * as awsConfig from '../config/aws.json'
import * as dbLib from '../libs/utils/DynamoDBManager'
import { CongressGovHelper } from '../libs/congressGov/CongressGovHelper'
import { CongressGovSponsorParser } from '../libs/congressGov/CongressGovSponsorParser'
import * as models from '../libs/congressGov/CongressGovModels'
import * as _ from 'lodash'
import { CongressGovAllInfoParser } from '../libs/congressGov/CongressGovAllInfoParser';

/**
 *  sync for sponsors & co-sponsors
 */
export class SponsorSync {
  private readonly db = dbLib.DynamoDBManager.instance()

  private readonly tblName = (<any> awsConfig).dynamodb.VOLUNTEER_BILLS_TABLE_NAME
  private readonly tbl = <dbLib.BillTable> this.db.getTable(this.tblName)

  private readonly tblRoleName = (<any> awsConfig).dynamodb.VOLUNTEER_ROLES_TABLE_NAME
  private readonly tblRole = <dbLib.RoleTable> this.db.getTable(this.tblRoleName)

  private readonly congressGovSponsorParser = new CongressGovSponsorParser()
  private readonly congressGovAllInfoParser = new CongressGovAllInfoParser()

  private roleMapSearchId = (bioGuideId: string, chamber: models.ChamberType) => bioGuideId + '-' + chamber

  public async syncSponsorForAllBills (
    currentCongress: number,
    minUpdateCongress: number = CongressGovHelper.MIN_CONGRESS_DATA_AVAILABLE,
    maxUpdateCongress: number = currentCongress
  ) {
    let bills = await this.tbl.getAllBills('id', 'congress', 'billType', 'billNumber', 'sponsor', 'cosponsors')

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

  public async batchSyncForCongress (congress: number, bills: dbLib.BillEntity[], currentCongress: number) {
    const roleMap = await this.buildRoleMapOfCongress(congress)

    let queryRole = (sponsor: models.CongressGovSponsor, bill: dbLib.BillEntity) => {
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
          throw new Error(`Found conflict roles = ${JSON.stringify(roles, null, 2)}`)
        }
      } else {
        console.log(`${billDisplay} --> ${sponsor.bioGuideId} ${sponsor.name} NOT found role entity.`)
      }
      return null
    }

    for (let i = 0; i < bills.length; ++i) {
      const bill = bills[i]
      const path = CongressGovHelper.generateCongressGovBillPath(bill.congress, bill.billType.code, bill.billNumber)
      const billDisplay = dbLib.DbHelper.displayBill(bill)

      console.log(`\n${billDisplay} -- Updating sponsor --\n`)

      const sponsor = await this.congressGovSponsorParser.getSponsorBioGuideId(path)
      const role = await queryRole(sponsor, bill)
      await this.tbl.updateSponsor(bill.id, role)

      console.log(`\n${billDisplay} -- Updating co-sponsors --\n`)
      const allInfo = await this.congressGovAllInfoParser.getAllInfo(path)
      const cosponsorEntities: dbLib.CosponsorEntity[] = []
      for (let j = 0; j < allInfo.cosponsors.length; ++j) {
        const item = allInfo.cosponsors[j]
        const entity = <dbLib.CosponsorEntity> {
          dateCosponsored: item.dateCosponsored
        }
        const cosponsorRole = await queryRole(item.sponsor, bill)
        if (cosponsorRole) {
          entity.sponsor = cosponsorRole
        }
        cosponsorEntities.push(entity)
      }
      await this.tbl.updateCoSponsors(bill.id, cosponsorEntities)

      console.log('\n\n')
    }

  }

  private async buildRoleMapOfCongress (congress: number): Promise<{[bioGuideId: string]: dbLib.RoleEntity[]}> {
    let roles = await this.tblRole.getRolesByCongress(congress)
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
sync.syncSponsorForAllBills(115, CongressGovHelper.MIN_CONGRESS_DATA_AVAILABLE, 101)