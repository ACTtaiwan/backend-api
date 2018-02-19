import { CongressGovAllInfoParser } from '../../libs/congressGov/CongressGovAllInfoParser'
import { CongressGovHelper } from '../../libs/congressGov/CongressGovHelper';
import { CongressGovSummary } from '../../libs/congressGov/CongressGovModels';
import * as dbLib from '../../libs/dbLib'
import * as s3Lib from '../../libs/s3Lib'
import * as awsConfig from '../../config/aws.json'
import * as _ from 'lodash'
import * as aws from 'aws-sdk'

export class AllInfoSync {
  public readonly congressGovAllInfoParser = new CongressGovAllInfoParser()

  private readonly db = dbLib.DynamoDBManager.instance()
  private readonly tblName = (<any> awsConfig).dynamodb.VOLUNTEER_BILLS_TABLE_NAME
  private readonly tbl = <dbLib.BillTable> this.db.getTable(this.tblName)

  private readonly s3 = s3Lib.S3Manager.instance()
  private readonly bcktName = (<any> awsConfig).s3.VOLUNTEER_BILLS_STATICINFO_BUCKET_NAME
  private readonly bckt = <s3Lib.BillStaticInfoBucket> this.s3.getBucket(this.bcktName)

  private congressBillsMap: {[congress: number]: dbLib.BillEntity[]}

  public async syncAllInfoForAllBills (
    currentCongress: number,
    minUpdateCongress?: number,
    maxUpdateCongress?: number,
    attrNames: (keyof dbLib.BillEntity)[] = ['detailTitles', 'actions', 'actionsAll', 'committees', 'relatedBills', 'subjects', 's3Entity']
  ) {
    const minCongress = Math.max(minUpdateCongress || CongressGovHelper.MIN_CONGRESS_DATA_AVAILABLE,
                                 CongressGovHelper.MIN_CONGRESS_DATA_AVAILABLE)
    const maxCongress = Math.min(maxUpdateCongress || currentCongress,
                                 currentCongress)

    console.log(`minCongress = ${minCongress} \t maxCongress = ${maxCongress}`)

    let bills = await this.tbl.getAllBills('id', 'congress', 'billType', 'billNumber', ...attrNames)
    bills = _.filter(bills, x => x.congress >= minCongress && x.congress <= maxCongress)

    // build congress <--> bills map
    this.congressBillsMap = _.groupBy(bills, 'congress')
    const keys = _.keys(this.congressBillsMap)
    for (let c = 0; c < keys.length; ++c) {
      let congress = parseInt(keys[c])
      console.log(`Updating congress = ${congress}`)
      await this.batchSyncForCongress(congress, currentCongress, attrNames)
      console.log('\n\n\n')
    }
  }

  public async batchSyncForCongress (congress: number, currentCongress: number, attrNames: (keyof dbLib.BillEntity)[]) {
    let hasAttr = (key: keyof dbLib.BillEntity): boolean => _.includes(attrNames, key)
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
        if (hasAttr('detailTitles')) {
          if (allInfo.titles && !_.isEmpty(allInfo.titles)) {
            updateBill.detailTitles = allInfo.titles
          } else if (bill.detailTitles) {
            removeAttrs.push('detailTitles')
          }
        }

        // actions overview
        if (hasAttr('actions')) {
          if (allInfo.actionsOverview && allInfo.actionsOverview.length > 0) {
            updateBill.actions = allInfo.actionsOverview
          } else if (bill.actions) {
            removeAttrs.push('actions')
          }
        }

        // actions all
        if (hasAttr('actionsAll')) {
          if (allInfo.actionsAll && allInfo.actionsAll.length > 0) {
            updateBill.actionsAll = allInfo.actionsAll
          } else if (bill.actionsAll) {
            removeAttrs.push('actionsAll')
          }
        }

        // committees
        if (hasAttr('committees')) {
          if (allInfo.committees && allInfo.committees.length > 0) {
            updateBill.committees = allInfo.committees
          } else if (bill.committees) {
            removeAttrs.push('committees')
          }
        }

        // relatedBills
        if (hasAttr('relatedBills')) {
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
        }

        // subjects
        if (hasAttr('subjects')) {
          if (allInfo.subjects && allInfo.subjects.length > 0) {
            updateBill.subjects = allInfo.subjects
          } else if (bill.subjects) {
            removeAttrs.push('subjects')
          }
        }

        if (hasAttr('s3Entity')) {
          if (allInfo.summaryLatest || allInfo.summaryAll) {
            const staticInfo = <s3Lib.BillStaticInfo> {
              summaryLatest: allInfo.summaryLatest || {},
              summaryAll: allInfo.summaryAll || []
            }
            const url = this.bckt.s3FullUrl(bill.congress, bill.billType.code, bill.billNumber)
            console.log(`Putting S3 object = ${url}`)
            await this.bckt.putEntity(staticInfo, bill.congress, bill.billType.code, bill.billNumber)
            updateBill.s3Entity = url
          } else if (bill.s3Entity) {
            removeAttrs.push('s3Entity')
          }
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
sync.syncAllInfoForAllBills(CongressGovHelper.CURRENT_CONGRESS, null, null, ['s3Entity'])
