import { Context, Callback, APIGatewayEvent } from 'aws-lambda'
import Response from '../../../libs/utils/Response'
import CongressGovParser from '../../../libs/congressGov/CongressGovParser'
import CongressGovUpdater from '../../../libs/congressGov/CongressGovUpdater'

/** Example:
 * {
 *   "path": "/bill/114th-congress/senate-bill/1635",
 *   "s3BucketPath": "114/s/1635/9bff167a-847c-4dd2-9732-315dd0828529"
 *  }
 */
interface CongressGovRequestPostBody {
  path: string
  s3BucketPath: string
}

class CongressGovHandler {
  public static handleRequest (event: APIGatewayEvent, context: Context, callback?: Callback) {
    let promise: Promise<any> = null

    if (event.httpMethod === 'POST') {
      promise = new Promise((resolve, reject) => {
        try {
          let postBody = <CongressGovRequestPostBody> JSON.parse(event.body)
          let updater = new CongressGovUpdater()
          updater.updateAllTextVersions(postBody.path, postBody.s3BucketPath)
            .then(() => resolve())
            .catch(error => reject(error))
        } catch (error) {
          reject(`Invalid Post Body. Error = ${error}`)
        }
      })
    } else if (event.httpMethod === 'GET') {
      let parser = new CongressGovParser()
      let billPath = event.queryStringParameters.path
      promise = parser.getAllTextVersions(billPath)
    }

    if (promise) {
      promise.then(response => {
        Response.success(callback, JSON.stringify(response), true)
      }).catch(error => {
        Response.error(callback, JSON.stringify(error), true)
      })
    } else {
      Response.error(callback, `No Handler For Request: ${JSON.stringify(event, null, 2)}`, true)
    }
  }
}

export let main = CongressGovHandler.handleRequest
