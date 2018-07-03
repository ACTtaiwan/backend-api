import * as dbLib from '../../libs/dbLib'
import { CongressGovHelper } from '../../libs/congressGov/CongressGovHelper'
import { CongressGovTrackerParser } from '../../libs/congressGov/CongressGovTrackerParser'
import * as models from '../../libs/congressGov/CongressGovModels'
import * as _ from 'lodash'
import * as mongoDbLib from '../../libs/mongodbLib'
import { MongoDbConfig } from '../../config/mongodb'

export class TrackerSync {
  private readonly congressGovTrackParser = new CongressGovTrackerParser()
  private tbl: mongoDbLib.BillTable

  public async init (): Promise<void> {
    if (!this.tbl) {
      let db = await mongoDbLib.MongoDBManager.instance
      const tblBillName = MongoDbConfig.tableNames.BILLS_TABLE_NAME
      this.tbl = db.getTable(tblBillName)
    }
    return Promise.resolve()
  }

  public async syncTrackersForBillEntity (bill: dbLib.BillEntity) {
    const path = CongressGovHelper.generateCongressGovBillPath(bill.congress, bill.billType.code, bill.billNumber)
    console.log(`[TrackerSync::syncTrackersForBillEntity()] path = ${path}`)
    const tracker = await this.congressGovTrackParser.getTracker(path)
    console.log(`[TrackerSync::syncTrackersForBillEntity()] got tracker`)
    if (!_.isEqual(bill.trackers, tracker)) {
      console.log(`[TrackerSync::syncTrackersForBillEntity()] Updating ${path}`)
      await this.tbl.updateTracker(bill.id, tracker)
    } else {
      console.log(`[TrackerSync::syncTrackersForBillEntity()] Not updating ${path} - same values`)
    }
  }

  public async syncTrackersForAllBills (currentCongress: number) {
    const bills = await this.tbl.getAllBills('id', 'congress', 'billType', 'billNumber', 'trackers')
    for (let i = 0; i < bills.length; ++i) {
      const bill = bills[i]
      const shouldNotUpdateReason = this.shouldUpdateTrackerForBill(bill, currentCongress)
      if (shouldNotUpdateReason) {
        console.log(`${dbLib.DbHelper.displayBill(bill)} not updating since ${shouldNotUpdateReason}`)
      } else {
        await this.syncTrackersForBillEntity(bill)
      }
      console.log('\n\n\n')
    }
  }

  public async syncTrackersForBill (congress: number, billTypeCode: models.BillTypeCode, billNumber: number) {
    const bill = await this.tbl.getBill(congress, billTypeCode, billNumber)
    await this.syncTrackersForBillEntity(bill)
  }

  public async printBillsHavingNoTrackers () {
    const bills = await this.tbl.getAllBills('id', 'congress', 'billType', 'billNumber', 'trackers')
    const noTrackerBills = _.filter(bills, b => !b.trackers || (b.trackers && b.trackers.length === 0))
    _.each(noTrackerBills, b => console.log(JSON.stringify(b, null, 2)))
  }

  private shouldUpdateTrackerForBill (bill: dbLib.BillEntity, currentCongress: number): string {
    const earliestCongress = CongressGovHelper.MIN_CONGRESS_DATA_AVAILABLE
    if (bill.trackers && bill.trackers.length > 0) {
      // having trackers
      if (bill.congress < currentCongress) {
        return `Trackers already available for non-current congress`
      }
    } else {
      // not having trackers
      if (bill.congress < earliestCongress) {
        return `Congress ${bill.congress} < ${earliestCongress} (earlist available)`
      }
    }
    return undefined
  }
}
