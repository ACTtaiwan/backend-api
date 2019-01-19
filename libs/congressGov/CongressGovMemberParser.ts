import { CongressGovDataProvider } from './CongressGovDataProvider'
import { CongressGovHelper } from './CongressGovHelper'

export class CongressGovMemberParser {
  private dataProvider = new CongressGovDataProvider()

  public getProfilePictureUrl (bioGuideId: string): Promise<string> {
    if (!bioGuideId) {
      return Promise.reject(new Error('invalid query. bioGuideId must be valid'))
    }

    const url = CongressGovHelper.generateCongressGovMemberUrl(bioGuideId)

    return new Promise((resolve, reject) => {
      console.log(`[CongressGovMemberParser::getProfilePictureUrl()] ready to fetch url = ${url}`)
      this.dataProvider.fetchMemberHtml(url).then($ => {
        console.log(`[CongressGovMemberParser::getProfilePictureUrl()] fetched done. Start parsing`)
        const picUrl = this.parsePictureUrl($)
        resolve(picUrl)
      }).catch(error => {
        reject(error)
      })
    });
  }

  private parsePictureUrl ($: any): string {
    let nodes: any[] = $('.overview-member-column-picture > a')
    if (nodes.length > 0) {
      let node = nodes[0]
      let href = node.attribs && node.attribs.href
      if (href) {
        return CongressGovHelper.CONGRESS_GOV_HOST + href;
      }
    }
    return undefined;
  }
}
