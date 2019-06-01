import { Context, Callback, APIGatewayEvent } from 'aws-lambda';
import Response from '../../../libs/utils/Response';
// import { SendGridAgent } from '../../../libs/subscribe/SendGridAgent';
// import { SendPulseAgent } from '../../../libs/subscribe/SendPulseAgent';
import { MailigenAgent } from '../../../libs/subscribe/MailigenAgent';

export class SendGridApi {

}

export interface SendGridHandlerParams {
  body?: {
    list?: 'act' | 'ustw'
    email?: string
    name?: string
    code?: string
  };
  pathAndQsp?: {
    path: string
    list?: 'act' | 'ustw'
    code?: string
    email?: string
  };
}

export class SendGridApiHandler {
  public static handleRequest (event: APIGatewayEvent, context: Context, callback?: Callback) {
    console.log(`[SendGridApiHandler::handleRequest()] event = ${JSON.stringify(event, null, 2)}`);

    // This freezes node event loop when callback is invoked
    context.callbackWaitsForEmptyEventLoop = false;

    let body = JSON.parse(event.body) || undefined;
    let params: SendGridHandlerParams = {
      body,
      pathAndQsp: {
        path: event.path,
        ...event.queryStringParameters,
        ...event.pathParameters
      }
    };

    // // unsubscribe
    // if (event.httpMethod === 'GET' && params.pathAndQsp && params.pathAndQsp.path.includes('unsubscribe/')) {
    //   SendPulseAgent.instance.then(async agent => {
    //     let html = await agent.unsubscribe(params.pathAndQsp.email, params.pathAndQsp.code, params.pathAndQsp.list);
    //     callback(null, {
    //       statusCode: 200,
    //       headers: { 'Content-Type': 'text/html; charset=utf-8' },
    //       body: html
    //     });
    //   });
    //   return;
    // }

    let promise = SendGridApiHandler.dispatchEvent(event.httpMethod, params);
    if (promise) {
      promise
        .then(response => {
          Response.success(callback, JSON.stringify(response), true);
        })
        .catch(error => {
          Response.error(callback, JSON.stringify(error), true);
        });
    } else {
      Response.error(callback, `No Handler For Request: ${JSON.stringify(event, null, 2)}`, true);
    }
  }

  public static dispatchEvent (httpMethod: string, params: SendGridHandlerParams): Promise<any> {
    // subscribe
    if (httpMethod === 'POST' && params.body) {
      let body = params.body;
      if (body) {
        console.log(`[SendGridApiHandler::dispatchEvent()] subscribe email = ${body.email}`);
        return MailigenAgent.instance.then(agent => {
          if (body.list === 'ustw') {
            return agent.subscribe(body.email, body.name, undefined, body.list);
          } else {
            // act site -> separate into first / last name
            const firstName = body.name.split(' ').slice(0, -1).join(' ');
            const lastName = body.name.split(' ').slice(-1).join(' ');
            return agent.subscribe(body.email, firstName, lastName, body.list);
          }
        });
      } else {
        let errObj = {
          error: 'POST body is missing'
        };
        console.log(`[SendGridApiHandler::dispatchEvent()] ERROR = ${JSON.stringify(errObj, null, 2)}`);
        return Promise.reject(errObj);
      }
    }
  }
}

export let main = SendGridApiHandler.handleRequest;
