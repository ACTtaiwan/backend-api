import * as _ from 'lodash'
import { CongressGovDataProvider } from './CongressGovDataProvider'
import { CongressGovHelper } from './CongressGovHelper'
import * as models from './CongressGovModels'
import Utility from '../utils/Utility';

export class CongressGovIntroDateParser {
  private dataProvider = new CongressGovDataProvider()

  // return [bioGuideId, name]
  public getIntroducedDate (billPath: string): Promise<number> {
    if (!billPath) {
      return Promise.reject(new Error('invalid query. Example Usage: ?path=/bill/115th-congress/house-bill/4288'))
    }
    const url = CongressGovHelper.billPathToTextUrl(billPath)

    return new Promise((resolve, reject) => {
      console.log(`[CongressGovIntroDateParser::getIntroducedDate()] ready to fetch url = ${url}`)
      this.dataProvider.fetchBillInfoHtml(url).then($ => {
        console.log(`[CongressGovIntroDateParser::getIntroducedDate()] fetched done. Start parsing tracker`)
        resolve(this.parseIntroducedDate($))
      }).catch(error => {
        reject(error)
      })
    })
  }

  private parseIntroducedDate ($: any): number {
    let textNode = $(`.overview a[href^='/member/']`).first().parent()
    let text = textNode.text()
    if (text) {
      console.log(`[CongressGovIntroDateParser::parseIntroducedDate()] introduced date found`)
      let dateMatch = text.match(/[0-9]{2}\/[0-9]{2}\/[0-9]{4}/)
      if (dateMatch && dateMatch.length === 1) {
        let dateStr = dateMatch[0]
        return Utility.parseDateTimeString(dateStr).getTime()
      }
    }
    return null
  }
}
