import { Context, Callback, APIGatewayEvent } from 'aws-lambda'
import Response from '../../../libs/utils/Response'
import { GoogleSheetAgent } from '../../../libs/googleApi/GoogleSheetAgent'

class GoogleApiHandler {
  public static handleRequest (event: APIGatewayEvent, context: Context, callback?: Callback) {
    let promise: Promise<any> = null

    if (event.httpMethod === 'GET') {
      let googleApiAgent = new GoogleSheetAgent()
      let q = (event.queryStringParameters && event.queryStringParameters.q) || ''
      promise = googleApiAgent.queryRange(q)
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

export let main = GoogleApiHandler.handleRequest
