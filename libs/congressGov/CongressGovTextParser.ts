import * as models from './CongressGovModels'
import { CongressGovDataProvider } from './CongressGovDataProvider'
import { CongressGovHelper } from './CongressGovHelper'
import Utility from '../utils/Utility'
import * as _ from 'lodash'

export class CongressGovTextParser {
  private dataProvider = new CongressGovDataProvider()
  private _versionLookupTable: {[code: string]: string} // key = code, value = version display name

  public getAllTextVersions (billPath: string): Promise<models.TextVersion[]> {
    if (!billPath) {
      return Promise.reject(new Error('invalid query. Example Usage: ?path=/bill/115th-congress/house-bill/4288'))
    }
    const url = CongressGovHelper.billPathToTextUrl(billPath)

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

  public get versionLookupTable () {
    return this._versionLookupTable
  }

  public set versionLookupTable (val: {[displayName: string]: string} ) {
    this._versionLookupTable = val
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
        let display: string = curVer[0].children[0].data
        let versionCode = 'unknown'

        if (this.versionLookupTable) {
          _.each(this.versionLookupTable, (displayName, code) => {
            if (display.toLowerCase().startsWith(displayName.toLowerCase())) {
              versionCode = code
              return false // break
            }
          })
        } else {
          if (display.startsWith('Introduced in Senate')) {
            versionCode = 'is'
          } else if (display.startsWith('Introduced in House')) {
            versionCode = 'ih'
          }
        }

        if (versionCode === 'unknown') {
          // 'Shown Here:' possibly with wrong version name. Try to find it again in full text
          let text: string = $('#billTextContainer').text()
          if (text && this.versionLookupTable) {
            let lines: string[] = text.split('\n').slice(0, 5) // scan first 5 lines
            if (lines && lines.length > 0) {
              let invVerMap = _.invert(this.versionLookupTable)
              let dispNames = _.keys(invVerMap)
              _.each(lines, l => {
                let found = _.find(dispNames, x => l.toLowerCase().includes(x.toLowerCase()) )
                if (found) {
                  versionCode = invVerMap[found]
                  return false // break
                }
              })
            }
          }

          // still can't find version code
          if (versionCode === 'unknown') {
            console.log(`[CongressGovTextParser::parseAllAvailableVersions()] version code not found = ${display}`)
          }
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
