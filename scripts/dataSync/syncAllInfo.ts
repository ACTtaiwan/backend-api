import { CongressGovAllInfoParser } from '../../libs/congressGov/CongressGovAllInfoParser'
import { CongressGovHelper } from '../../libs/congressGov/CongressGovHelper';
import { CongressGovSummary } from '../../libs/congressGov/CongressGovModels';
import * as dbLib from '../../libs/dbLib/DbLib'
import * as awsConfig from '../config/aws.json'
import * as _ from 'lodash'
import * as aws from 'aws-sdk'

export class AllInfoSync {
  public readonly congressGovAllInfoParser = new CongressGovAllInfoParser()

  private readonly db = dbLib.DynamoDBManager.instance()
  private readonly tblName = (<any> awsConfig).dynamodb.VOLUNTEER_BILLS_TABLE_NAME
  private readonly tbl = <dbLib.BillTable> this.db.getTable(this.tblName)

  private congressBillsMap: {[congress: number]: dbLib.BillEntity[]}

  public async syncAllInfoForAllBills (currentCongress: number, minUpdateCongress?: number, maxUpdateCongress?: number) {
    const minCongress = Math.max(minUpdateCongress || CongressGovHelper.MIN_CONGRESS_DATA_AVAILABLE,
                                 CongressGovHelper.MIN_CONGRESS_DATA_AVAILABLE)
    const maxCongress = Math.min(maxUpdateCongress || currentCongress,
                                 currentCongress)

    console.log(`minCongress = ${minCongress} \t maxCongress = ${maxCongress}`)

    let bills = await this.tbl.getAllBills(
      'id', 'congress', 'billType', 'billNumber',
      'detailTitles', 'actions', 'actionsAll', 'committees', 'relatedBills', 'subjects')
    bills = _.filter(bills, x => x.congress >= minCongress && x.congress <= maxCongress)

    // build congress <--> bills map
    this.congressBillsMap = _.groupBy(bills, 'congress')
    const keys = _.keys(this.congressBillsMap)
    for (let c = 0; c < keys.length; ++c) {
      let congress = parseInt(keys[c])
      console.log(`Updating congress = ${congress}`)
      await this.batchSyncForCongress(congress, currentCongress)
      console.log('\n\n\n')
    }
  }

  public async batchSyncForCongress (congress: number, currentCongress: number) {
    let bills: dbLib.BillEntity[] = this.congressBillsMap[congress]
    for (let i = 0; i < bills.length; ++i) {
      const bill = bills[i]
      const path = CongressGovHelper.generateCongressGovBillPath(bill.congress, bill.billType.code, bill.billNumber)
      const billDisplay = dbLib.DbHelper.displayBill(bill)

      console.log(`\n${billDisplay} -- Updating all info --\n`)

      const allInfo = await this.congressGovAllInfoParser.getAllInfo(path)
      if (allInfo) {
        let updateBill = <dbLib.BillEntity>{}
        let removeAttrs: (keyof dbLib.BillEntity)[] = []

        // titles
        if (allInfo.titles && !_.isEmpty(allInfo.titles)) {
          updateBill.detailTitles = allInfo.titles
        } else if (bill.detailTitles) {
          removeAttrs.push('detailTitles')
        }

        // actions overview
        if (allInfo.actionsOverview && allInfo.actionsOverview.length > 0) {
          updateBill.actions = allInfo.actionsOverview
        } else if (bill.actions) {
          removeAttrs.push('actions')
        }

        // actions all
        if (allInfo.actionsAll && allInfo.actionsAll.length > 0) {
          updateBill.actionsAll = allInfo.actionsAll
        } else if (bill.actionsAll) {
          removeAttrs.push('actionsAll')
        }

        // committees
        if (allInfo.committees && allInfo.committees.length > 0) {
          updateBill.committees = allInfo.committees
        } else if (bill.committees) {
          removeAttrs.push('committees')
        }

        // committees
        if (allInfo.relatedBills && allInfo.relatedBills.length > 0) {
          updateBill.relatedBills = allInfo.relatedBills
          _.each(updateBill.relatedBills, related => {
            const existingBill = _.find(bills, b => b.congress === related.congress
                                                 && b.billType.code === related.typeCode
                                                 && b.billNumber === related.billNumber)
            if (existingBill) {
              related.id = existingBill.id
            }
          })
        } else if (bill.relatedBills) {
          removeAttrs.push('relatedBills')
        }

        // subjects
        if (allInfo.subjects && allInfo.subjects.length > 0) {
          updateBill.subjects = allInfo.subjects
        } else if (bill.subjects) {
          removeAttrs.push('subjects')
        }

        if (!_.isEmpty(updateBill)) {
          try {
            console.log(`Writing to database. Main object. Size = ${JSON.stringify(updateBill).length}`)
            await this.tbl.updateBill(bill.id, updateBill)
          } catch (error) {
            let e = (error as aws.AWSError)
            throw new Error(`DB error = ${JSON.stringify(error, null, 2)}`)
          }
        }

        if (removeAttrs.length > 0) {
          console.log(`Removing attributes = ${JSON.stringify(removeAttrs)}`)
          await this.tbl.deleteAttributesFromBill(bill.id, ...removeAttrs)
        }
      } else {
        console.log(`parsing failed\n`)
      }
    }
  }
}

let sync = new AllInfoSync()
sync.syncAllInfoForAllBills(115)

