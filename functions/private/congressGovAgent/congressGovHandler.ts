import { Context, Callback, APIGatewayEvent } from 'aws-lambda'
import Response from '../../../libs/utils/Response'
import Utility from '../../../libs/utils/Utility'
import * as models from '../../../libs/congressGov/CongressGovModels'
import { CongressGovTextParser } from '../../../libs/congressGov/CongressGovTextParser'
import { CongressGovTextUpdater } from '../../../libs/congressGov/CongressGovTextUpdater'
import { BillTextContentType } from '../../../libs/s3Lib';

/** Example:
 *   ?path=/bill/114th-congress/senate-bill/1635
 */
class CongressGovRequestGetParams {
  public static readonly PATH: string = 'path'
}

/** Example:
 * {
 *   "path": "/bill/114th-congress/senate-bill/1635",
 *  }
 */
interface CongressGovRequestPostBody {
  path: string
}

/** Example:
 * {
 *   "versionCode": "eah",
 *   "date": "2016-12-05",
 *   "contentType": "xml",
 *   "url": "https://www.congress.gov/114/bills/s1635/BILLS-114s1635eah.xml",
 *   "congress": 114
 *   "billTypeCode": "s"
 *   "billNumber": 1635
 * }
 */
interface CongressGovRequestPutBody {
  versionCode: string
  date: string
  contentType: BillTextContentType
  url: string
  congress: number
  billTypeCode: models.BillTypeCode
  billNumber: number
}

class CongressGovHandler {
  public static handleRequest (event: APIGatewayEvent, context: Context, callback?: Callback) {
    console.log(`[CongressGovHandler::handleRequest()] event = ${JSON.stringify(event, null, 2)}`)
    let promise: Promise<any> = null

    if (event.httpMethod === 'POST') {
      promise = new Promise((resolve, reject) => {
        try {
          let postBody = <CongressGovRequestPostBody>JSON.parse(event.body)
          let updater = new CongressGovTextUpdater()
          updater
            .updateAllTextVersions(postBody.path)
            .then(() => resolve())
            .catch(error => reject(error))
        } catch (error) {
          reject(new Error(`Invalid Post Body. Error = ${error}`))
        }
      })
    } else if (event.httpMethod === 'PUT') {
      promise = new Promise((resolve, reject) => {
        try {
          let putBody = <CongressGovRequestPutBody>JSON.parse(event.body)
          let updater = new CongressGovTextUpdater()
          let text = <models.TextVersion>{
            versionCode: putBody.versionCode,
            date: Utility.parseDateTimeStringOfFormat(putBody.date + ' -0500', 'YYYY-MM-DD Z')
          }
          switch (putBody.contentType) {
            case 'xml':
              text.fullTextXmlUrl = putBody.url
              break

            case 'txt':
              text.fullTextUrl = putBody.url
              break

            case 'pdf':
              text.fullTextPdfUrl = putBody.url
              break
          }
          updater
            .updateTextVersion(text, putBody.congress, putBody.billTypeCode, putBody.billNumber)
            .then(() => resolve())
            .catch(error => reject(error))
        } catch (error) {
          reject(new Error(`Invalid Put Body. Error = ${error}`))
        }
      })
    } else if (event.httpMethod === 'GET') {
      let parser = new CongressGovTextParser()
      let billPath = event.queryStringParameters[CongressGovRequestGetParams.PATH]
      promise = parser.getAllTextVersions(billPath)
    }

    if (promise) {
      promise
        .then(response => {
          Response.success(callback, JSON.stringify(response), true)
        })
        .catch(error => {
          Response.error(callback, JSON.stringify(error), true)
        })
    } else {
      Response.error(callback, `No Handler For Request: ${JSON.stringify(event, null, 2)}`, true)
    }
  }
}

export let main = CongressGovHandler.handleRequest
