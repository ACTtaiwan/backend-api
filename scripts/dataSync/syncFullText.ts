import { CongressGovTextUpdater } from '../../libs/congressGov/CongressGovTextUpdater'
import { CongressGovHelper } from '../../libs/congressGov/CongressGovHelper';
import * as dbLib from '../../libs/dbLib'
import * as s3Lib from '../../libs/s3Lib'
import * as _ from 'lodash'
import * as fs from 'fs'
import * as moment from 'moment'

var awsConfig = require('../../config/aws.json');

export class FullTextSync {
  public  readonly updater = new CongressGovTextUpdater()

  private readonly s3 = s3Lib.S3Manager.instance()
  private readonly bcktName = (<any> awsConfig).s3.VOLUNTEER_BILLS_FULLTEXT_BUCKET_NAME
  public  readonly bckt = <s3Lib.BillTextBucket> this.s3.getBucket(this.bcktName)

  private readonly db = dbLib.DynamoDBManager.instance()

  private readonly tblBillName = (<any> awsConfig).dynamodb.VOLUNTEER_BILLS_TABLE_NAME
  public  readonly tblBill = <dbLib.BillTable> this.db.getTable(this.tblBillName)

  private readonly tblVrsnName = (<any> awsConfig).dynamodb.VOLUNTEER_BILLVERSIONS_TABLE_NAME
  private readonly tblVrsn = <dbLib.BillVersionTable> this.db.getTable(this.tblVrsnName)
  private _allVersionMap: {[code: string]: dbLib.BillVersionEntity}

  private congressBillsMap: {[congress: number]: dbLib.BillEntity[]}

  private readonly loggerFile: string

  constructor (useLogging: boolean = true) {
    if (useLogging) {
      this.loggerFile = `./log-${moment(new Date()).format('YYYYMMDD-hhmmss')}.txt`
      fs.writeFileSync(this.loggerFile, '')
    }
  }

  public async syncAllBills (currentCongress: number, minUpdateCongress?: number, maxUpdateCongress?: number) {
    const minCongress = Math.max(minUpdateCongress || CongressGovHelper.MIN_CONGRESS_DATA_AVAILABLE,
                                 CongressGovHelper.MIN_CONGRESS_DATA_AVAILABLE)
    const maxCongress = Math.min(maxUpdateCongress || currentCongress,
                                 currentCongress)

    console.log(`minCongress = ${minCongress} \t maxCongress = ${maxCongress}`)

    let bills = await this.tblBill.getAllBills('id', 'congress', 'billType', 'billNumber', 'versions')
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
      await this.syncBill(bill)
    }
  }

  public async syncBill (bill: dbLib.BillEntity): Promise<void> {
    const billDisplay = dbLib.DbHelper.displayBill(bill)
    console.log(`\n---------------------------------- Updating ${billDisplay} ----------------------------------\n\n`)
    try {
      await this.uploadAllText(bill)
      let update = await this.updateMongoDb(bill)
      console.log(`\nUPDATED = ${JSON.stringify(update, null, 2)}\n`)
    } catch (err) {
      if (this.loggerFile) {
        fs.appendFileSync(this.loggerFile, `[${billDisplay}] ${err}\n`)
      }
    }
  }

  public async listAllBillsForVersionCode (versionCode: string): Promise<dbLib.BillEntity[]> {
    let bills = await this.tblBill.getAllBills('id', 'congress', 'billType', 'billNumber', 'versions')
    bills = _.filter(bills, b => b.versions && !!_.find(b.versions, v => v.code === versionCode))
    console.log(JSON.stringify(bills, null, 2))
    return bills
  }

  private async updateMongoDb (bill: dbLib.BillEntity): Promise<dbLib.BillEntity> {
    const s3Items = await this.bckt.listDocumentsOfBill(bill.congress, bill.billType.code, bill.billNumber)
    const s3ItemMap = _.groupBy(s3Items, 'code')
    const versionMap = await this.getAllVersionMap()
    const versions: {[code: string]: dbLib.BillTextDocument} = {}
    _.each(s3ItemMap, (items, code) => {
      let obj = (<dbLib.BillTextDocument> _.clone(versionMap[ code ]))
      if (!obj) {
        _.each(versionMap, (val, key) => {
          if (code.startsWith(key)) {
            obj = _.clone(val)
            return false // break
          }
        })
        if (!obj) {
          throw new Error(`[FullTextSync::updateMongoDb()] can not find bill version for code = ${code}`)
        }
      }
      if (items && items[0] && items[0].date) {
        obj.date = items[0].date
      }

      obj.documents = []
      _.each(items, doc => {
        if (doc.s3BucketKey) {
          obj.documents.push({
            s3Entity: s3Lib.S3BucketHelper.generateFullUrl(this.bckt.bucketName, doc.s3BucketKey),
            contentType: doc.contentType
          })
        }
      })
      versions[code] = obj
    })
    const update = <dbLib.BillEntity> {}
    update.versions = _.values(versions)
    return _.isEmpty(update) ? Promise.resolve(null) : this.tblBill.updateBill(bill.id, update).then(() => update)
  }

  private getAllVersionMap (): Promise<{[code: string]: dbLib.BillVersionEntity}> {
    if (this._allVersionMap) {
      return Promise.resolve(this._allVersionMap)
    } else {
      return this.tblVrsn.getAllVersions().then(versions => {
        this._allVersionMap = _.keyBy(versions, 'code')
        return this._allVersionMap
      })
    }
  }

  private async uploadAllText (bill: dbLib.BillEntity): Promise<void> {
    const versionMap = await this.getAllVersionMap()
    const codeNameMap: {[displayName: string]: string} = _.transform(versionMap, (res, val, key) => res[key] = val.name, {})
    this.updater.parser.versionLookupTable = codeNameMap
    const cngrGovBillPath = CongressGovHelper.generateCongressGovBillPath(bill.congress, bill.billType.code, bill.billNumber)
    return this.updater.updateAllTextVersions(cngrGovBillPath)
  }
}

let sync = new FullTextSync(false)
sync.syncAllBills(CongressGovHelper.CURRENT_CONGRESS, CongressGovHelper.CURRENT_CONGRESS)

// problems:
//   [106-s-1059 (154155dd-0d68-4a15-ae54-98f747fdef66)] Error: [FullTextSync::updateMongoDb()] can not find bill version for code = pwh

// sync.syncBill(<any> {
//   id: '154155dd-0d68-4a15-ae54-98f747fdef66',
//   congress: 106,
//   billType: {code: 's'},
//   billNumber: 1059
// })

// let bills = sync.listAllBillsForVersionCode('pwah')
