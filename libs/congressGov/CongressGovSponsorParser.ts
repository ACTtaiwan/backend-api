import * as _ from 'lodash'
import { CongressGovDataProvider } from './CongressGovDataProvider'
import { CongressGovHelper } from './CongressGovHelper'
import * as models from './CongressGovModels'

export class CongressGovSponsorParser {
  private dataProvider = new CongressGovDataProvider()

  // return [bioGuideId, name]
  public getSponsorBioGuideId (billPath: string): Promise<models.CongressGovSponsor> {
    if (!billPath) {
      return Promise.reject(new Error('invalid query. Example Usage: ?path=/bill/115th-congress/house-bill/4288'))
    }
    const url = CongressGovHelper.billPathToTextUrl(billPath)

    return new Promise((resolve, reject) => {
      console.log(`[CongressGovSponsorParser::getTracker()] ready to fetch url = ${url}`)
      this.dataProvider.fetchBillInfoHtml(url).then($ => {
        console.log(`[CongressGovSponsorParser::getTracker()] fetched done. Start parsing tracker`)
        resolve(this.parseSponsor($))
      }).catch(error => {
        reject(error)
      })
    })
  }

  private parseSponsor ($: any): models.CongressGovSponsor {
    let nodes: any[] = $(`.overview a[href^='/member/']`)
    if (nodes.length === 1 && nodes[0].attribs && nodes[0].attribs.href) {
      console.log(`[CongressGovSponsorParser::parseSponsor()] sponsor found`)
      let path: string = nodes[0].attribs.href
      let congressGovUrl = path && CongressGovHelper.pathToFullUrl(path)
      let bioGuideId = path.split('/').pop()
      let name = nodes[0].children[0].data || ''
      return {congressGovUrl, bioGuideId, name}
    }
    return null
  }
}
