import * as dbLib from '../dbLib'
import * as cheerio from 'cheerio'
import Utility from '../utils/Utility'

var awsConfig = require('../../config/aws.json');

export class CongressGovDataProvider {
  public static readonly EXPIRE_IN_MIN_BASIC_INFO: number = 60 * 24 * 1 // 1 day
  public static readonly EXPIRE_IN_MIN_ALL_INFO: number = 60 * 24 * 1 // 1 day
  public static readonly EXPIRE_IN_MIN_TEXT: number = -1; // never

  private db = dbLib.DynamoDBManager.instance()

  public fetchBillInfoHtml (url: string): Promise<any> {
    console.log(`[CongressGovDataProvider::fetchBillInfoHtml()] start, url = ${url}`)
    return this.fetchBillHtml(url, CongressGovDataProvider.EXPIRE_IN_MIN_BASIC_INFO)
  }

  public fetchBillAllInfoHtml (url: string): Promise<any> {
    console.log(`[CongressGovDataProvider::fetchBillAllInfoHtml()] start, url = ${url}`)
    return this.fetchBillHtml(url, CongressGovDataProvider.EXPIRE_IN_MIN_ALL_INFO)
  }

  public fetchBillTextHtml (url: string): Promise<any> {
    console.log(`[CongressGovDataProvider::fetchBillTextHtml()] start, url = ${url}`)
    return this.fetchBillHtml(url, CongressGovDataProvider.EXPIRE_IN_MIN_TEXT)
  }

  private fetchBillHtml (url: string, expireIn: number): Promise<any> {
    console.log(`[CongressGovDataProvider::fetchBillContent()] start, url = ${url}`)
    const tblName = (<any> awsConfig).dynamodb.CONGRESSGOV_SYNC_BILL_TABLE_NAME
    const tbl = <dbLib.CongressGovSyncBillTable> this.db.getTable(tblName)

    return tbl.getObjectByUrlPath(url).then(obj => {
      if (obj) {
        console.log(`[CongressGovDataProvider::fetchBillContent()] cache found`)
        if (this.isExpired(obj.lastUpdate, expireIn)) {
          console.log(`[CongressGovDataProvider::fetchBillContent()] cache is expired`)
          return this.updateDbContent(tbl, url)
        } else {
          return cheerio.load(obj.rawData)
        }
      } else {
        console.log(`[CongressGovDataProvider::fetchBillContent()] cache not found - fetching & updating`)
        return this.updateDbContent(tbl, url)
      }
    })
  }

  private updateDbContent (tbl: dbLib.CongressGovSyncBillTable, url: string): any {
    return Utility.fetchUrlContent(url).then(body => {
      console.log(`[CongressGovDataProvider::fetchBillContent()] URL content fetched`)
      tbl.putObject({
        urlPath: url,
        rawData: body
      })
      return cheerio.load(body)
    })
  }

  private isExpired (lastUpdate: number, expireInMin: number): boolean {
    if (!lastUpdate) {
      return true
    } else {
      if (expireInMin < 0) {
        console.log(`[CongressGovDataProvider::isExpired()] never expired`);
        return false
      } else {
        const now = new Date().getTime()
        const diff = now - lastUpdate
        const diffInMin = diff / 1000.0 / 60.0
        const expired = diffInMin > expireInMin
        console.log(`[CongressGovDataProvider::isExpired()]
          lastUpdate = ${lastUpdate}
          now = ${now}
          diffInMin = ${diffInMin}
          threshold = ${expireInMin}
          expired = ${expired}`)
        return expired
      }
    }
  }
}
