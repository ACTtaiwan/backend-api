import * as awsConfig from '../config/aws.json'
import * as dbLib from '../libs/utils/DynamoDBManager'
import { CongressGovHelper } from '../libs/congressGov/CongressGovHelper'
import { CongressGovTrackerParser } from '../libs/congressGov/CongressGovTrackerParser'
import * as models from '../libs/congressGov/CongressGovModels'
import * as _ from 'lodash'

const tblName = (<any> awsConfig).dynamodb.VOLUNTEER_BILLS_TABLE_NAME
const tbl = <dbLib.BillTable> dbLib.DynamoDBManager.instance().getTable(tblName)
const congressGovTrackParser = new CongressGovTrackerParser()

let syncTrackersForBillEntity = async (bill: dbLib.BillEntity) => {
  const path = CongressGovHelper.generateCongressGovBillPath(bill.congress, bill.billType.code, bill.billNumber)
  console.log(`Updating ${path}`)
  const tracker = await congressGovTrackParser.getTracker(path)
  await tbl.updateTracker(bill.id, tracker)
}

let syncTrackersForAllBills = async () => {
  const earliestCongress = CongressGovHelper.MIN_CONGRESS_DATA_AVAILABLE
  const bills = await tbl.getAllBills()
  for (let i = 0; i < bills.length; ++i) {
    const bill = bills[i]
    if (bill.congress >= earliestCongress) {
      await syncTrackersForBillEntity(bill)
    } else {
      console.log(`${dbLib.DbHelper.displayBill(bill)} Data unavailable
      due to Congress ${bill.congress} < ${earliestCongress} (earlist available)`)
    }
  }
}

let syncTrackersForBill = async (congress: number, billTypeCode: models.BillTypeCode, billNumber: number) => {
  const bill = await tbl.getBill(congress, billTypeCode, billNumber)
  await syncTrackersForBillEntity(bill)
}

syncTrackersForAllBills()
// syncTrackersForBill(114, 'hconres', 88)