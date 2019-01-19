import * as mongoDbLib from '../mongodbLib'
import * as cheerio from 'cheerio'
import Utility from '../utils/Utility'
import { MongoDbConfig } from '../../config/mongodb'

export class CongressGovDataProvider {
  public static readonly EXPIRE_IN_MIN_BASIC_INFO: number = 60 * 24 * 1 // 1 day
  public static readonly EXPIRE_IN_MIN_ALL_INFO: number = 60 * 24 * 1 // 1 day
  public static readonly EXPIRE_IN_MIN_MEMBER: number = 60 * 24 * 1 // 1 day
  public static readonly EXPIRE_IN_MIN_TEXT: number = -1; // never

  public fetchBillInfoHtml (url: string): Promise<any> {
    console.log(`[CongressGovDataProvider::fetchBillInfoHtml()] start, url = ${url}`)
    return this.fetchHtml(url, CongressGovDataProvider.EXPIRE_IN_MIN_BASIC_INFO)
  }

  public fetchBillAllInfoHtml (url: string): Promise<any> {
    console.log(`[CongressGovDataProvider::fetchBillAllInfoHtml()] start, url = ${url}`)
    return this.fetchHtml(url, CongressGovDataProvider.EXPIRE_IN_MIN_ALL_INFO)
  }

  public fetchBillTextHtml (url: string): Promise<any> {
    console.log(`[CongressGovDataProvider::fetchBillTextHtml()] start, url = ${url}`)
    return this.fetchHtml(url, CongressGovDataProvider.EXPIRE_IN_MIN_TEXT)
  }

  public fetchMemberHtml (url: string): Promise<any> {
    console.log(`[CongressGovDataProvider::fetchMemberHtml()] start, url = ${url}`)
    return this.fetchHtml(url, CongressGovDataProvider.EXPIRE_IN_MIN_MEMBER)
  }

  private async fetchHtml (url: string, expireIn: number): Promise<any> {
    console.log(`[CongressGovDataProvider::fetchHtml()] start, url = ${url}`)
    const tbl = await CongressGovDataProvider.getCacheTable()

    return tbl.getObjectByUrlPath(url).then(obj => {
      if (obj) {
        console.log(`[CongressGovDataProvider::fetchHtml()] cache found`)
        if (this.isExpired(obj.lastUpdate, expireIn)) {
          console.log(`[CongressGovDataProvider::fetchHtml()] cache is expired`)
          return this.updateDbContent(tbl, url)
        } else {
          return cheerio.load(obj.rawData)
        }
      } else {
        console.log(`[CongressGovDataProvider::fetchHtml()] cache not found - fetching & updating`)
        return this.updateDbContent(tbl, url)
      }
    })
  }

  private updateDbContent (tbl: mongoDbLib.CongressGovSyncBillTable, url: string): any {
    return Utility.fetchUrlContent(url).then(body => {
      console.log(`[CongressGovDataProvider::updateDbContent()] URL content fetched`)
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

  private static async getCacheTable () {
    const tblName = MongoDbConfig.tableNames.CONGRESSGOV_SYNC_BILL_TABLE_NAME
    const db = await mongoDbLib.MongoDBManager.instance
    const tblCat = db.getTable<mongoDbLib.CongressGovSyncBillTable>(tblName)
    return tblCat
  }
}
