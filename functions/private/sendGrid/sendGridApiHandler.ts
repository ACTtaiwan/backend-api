import { Context, Callback, APIGatewayEvent } from 'aws-lambda'
import Response from '../../../libs/utils/Response'
import * as _ from 'lodash'
// import { SendGridAgent } from '../../../libs/subscribe/SendGridAgent';
import { SendPulseAgent } from '../../../libs/subscribe/SendPulseAgent'

export class SendGridApi {

}

export class SendGridHandlerParams {
  body?: {
    list?: 'act' | 'ustw'
    email?: string
    name?: string
  }
}

export class SendGridApiHandler {
  public static handleRequest (event: APIGatewayEvent, context: Context, callback?: Callback) {
    console.log(`[SendGridApiHandler::handleRequest()] event = ${JSON.stringify(event, null, 2)}`)

    // This freezes node event loop when callback is invoked
    context.callbackWaitsForEmptyEventLoop = false;

    let body = JSON.parse(event.body) || undefined
    let params: SendGridHandlerParams = {
      body
    }
    let promise = SendGridApiHandler.dispatchEvent(event.httpMethod, params)
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

  public static dispatchEvent (httpMethod: string, params: SendGridHandlerParams): Promise<any> {
    // subscribe
    if (httpMethod === 'POST' && params.body) {
      let body = params.body
      if (body) {
        console.log(`[SendGridApiHandler::dispatchEvent()] subscribe email = ${body.email}`)
        return SendPulseAgent.instance.then(agent => agent.subscribe(body.email, body.name, undefined, body.list))
      } else {
        let errObj = {
          error: 'POST body is missing'
        }
        console.log(`[SendGridApiHandler::dispatchEvent()] ERROR = ${JSON.stringify(errObj, null, 2)}`)
        return Promise.reject(errObj)
      }
    }
  }
}

export let main = SendGridApiHandler.handleRequest
