import * as models from './CongressGovModels'
import { CongressGovDataProvider } from './CongressGovDataProvider'
import { CongressGovHelper } from './CongressGovHelper'
import Utility from '../utils/Utility'

export class CongressGovTextParser {
  private dataProvider = new CongressGovDataProvider()

  public getAllTextVersions (billPath: string): Promise<models.TextVersion[]> {
    if (!billPath) {
      return Promise.reject(new Error('invalid query. Example Usage: ?path=/bill/115th-congress/house-bill/4288'))
    }
    const url = this.dataProvider.billPathToTextUrl(billPath)

    return new Promise((resolve, reject) => {
      console.log(`[CongressGovTextParser::getAllTextVersions()] ready to fetch url = ${url}`)
      this.dataProvider.fetchBillInfoHtml(url).then($ => {
        console.log(`[CongressGovTextParser::getAllTextVersions()] fetched done. Start parsing all text versions`)
        const versions = this.parseAllAvailableVersions($)
        console.log(`[CongressGovTextParser::getAllTextVersions()] all versions parsed = ${JSON.stringify(versions, null, 2)}`)

        let promises = []
        versions.forEach(v => {
          v.fullTextUrl = url + '/' + v.versionCode + '?format=txt'

          promises.push(
            this.parseFullText(v.fullTextUrl).then(fullText => v.fullText = fullText)
          )

          promises.push(
            this.parseXmlPdfUrl(v.fullTextUrl).then(([xmlUrl, pdfUrl]) => {
              v.fullTextXmlUrl = xmlUrl
              v.fullTextPdfUrl = pdfUrl
            })
          )
        })

        Promise.all(promises).then(() => {
          resolve(versions)
        }).catch(error => {
          reject(error)
        })
      }).catch(error => {
        reject(error)
      })
    })
  }

  private parseAllAvailableVersions ($: any): models.TextVersion[] {
    let versions = $('#textVersion > option')
    let results: models.TextVersion[] = []
    if (versions.length > 0) {
      for (var i = 0; i < versions.length; ++i) {
        let versionCode = versions[i].attribs.value
        let display = versions[i].children[0].data
        results.push({versionCode, display})
      }
    } else {
      // try to parse single version
      let curVer = $(`h3[class='currentVersion'] > span`)
      if (curVer.length === 1 && curVer[0].children.length === 1 && curVer[0].children[0].data) {
        let display = curVer[0].children[0].data
        let versionCode = 'unknown'
        if (display.startsWith('Introduced in Senate')) {
          versionCode = 'is'
        } else if (display.startsWith('Introduced in House')) {
          versionCode = 'ih'
        }
        results.push({versionCode, display})
      }
    }

    // process date time string
    results.forEach(v => {
      var re = /\([^)]*\)|\[[^\]]*\]/g;
      let matches = v.display.match(re)

      // remove date string within parenthesis
      v.display = v.display.replace(re, '').trim()

      if (matches && matches.length === 1) {
        v.date = Utility.parseDateTimeString(matches[0])
      }
    })

    return results
  }

  private parseFullText (url: string): Promise<string> {
    console.log(`[CongressGovTextParser::parseFullText()] parsing full text from url = ${url}`)

    return this.dataProvider.fetchBillTextHtml(url).then($ => {
      console.log(`[CongressGovTextParser::parseFullText()] got HTML content`)

      let text = $('#billTextContainer')
      if (text.length === 1 && text[0].children.length === 1 && text[0].children[0].data) {
        console.log(`[CongressGovTextParser::parseFullText()] full text found`)
        return text[0].children[0].data
      }

      console.log(`[CongressGovTextParser::parseFullText()] full text NOT found`)
      return undefined
    })
  }

  private parseXmlPdfUrl (url: string): Promise<[string, string]> {
    console.log(`[CongressGovTextParser::parseXmlPdfUrl()] parsing XML / PDF links from url = ${url}`)

    return this.dataProvider.fetchBillTextHtml(url).then($ => {
      console.log(`[CongressGovTextParser::parseXmlPdfUrl()] got HTML content`)

      let findLink = (query: string): string => {
        let nodes = $(query)
        if (nodes.length === 1 && nodes[0].attribs && nodes[0].attribs.href) {
          return CongressGovHelper.CONGRESS_GOV_HOST + nodes[0].attribs.href
        } else {
          return undefined
        }
      }

      let xmlLink = findLink(`#main a[href$='.xml']`)
      console.log(`[CongressGovTextParser::parseXmlPdfUrl()] xmlLink = ${xmlLink}`)

      let pdfLink = findLink(`#main a[href$='.pdf']`)
      console.log(`[CongressGovTextParser::parseXmlPdfUrl()] pdfLink = ${pdfLink}`)

      return <[string, string]>[xmlLink, pdfLink]
    })
  }
}
