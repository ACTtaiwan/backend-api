import { Context, Callback, APIGatewayEvent } from 'aws-lambda'
import Utility from '../../../libs/utils/Utility'
import * as _ from 'lodash'
import Response from '../../../libs/utils/Response'
import * as dbLib from '../../../libs/dbLib'
import { TagManager } from '../../../libs/dataManager/TagManager';

export class TagApi {
  private readonly tagMngr = new TagManager()

  public async getTags (tags: string[]): Promise<dbLib.TagEntity[]> {
    await this.tagMngr.init()
    console.log(`[TagApi::getTags()] id = ${JSON.stringify(tags, null, 2)}`)
    return (tags && tags.length > 0) ? this.tagMngr.getTags([...tags]) : Promise.resolve([])
  }

  public async searchTagStartWith (q: string): Promise<string[]> {
    await this.tagMngr.init()
    console.log(`[TagApi::searchTagStartWith()] q = ${JSON.stringify(q, null, 2)}`)
    return this.tagMngr.searchTagStartWith(q, ['tag']).then(out => _.map(out, x => x.tag))
  }

  public async searchTagContains (q: string): Promise<string[]> {
    await this.tagMngr.init()
    console.log(`[TagApi::searchTagContains()] q = ${JSON.stringify(q, null, 2)}`)
    return this.tagMngr.searchTagContains(q, ['tag']).then(out => _.map(out, x => x.tag))
  }
}

/**
 *
 * TagHandler
 *
 */

export class TagHandlerGetParams {
  tag?: string
  q?: string
}

export class TagHandler {
  public static handleRequest (event: APIGatewayEvent, context: Context, callback?: Callback) {
    console.log(`[TagHandler::handleRequest()] event = ${JSON.stringify(event, null, 2)}`)

    // This freezes node event loop when callback is invoked
    context.callbackWaitsForEmptyEventLoop = false;

    let params: TagHandlerGetParams = {
      tag:
           (event.pathParameters && event.pathParameters.tag)
        || (event.queryStringParameters && event.queryStringParameters.tag)
        || undefined,
      q:
           (event.pathParameters && event.pathParameters.q)
        || (event.queryStringParameters && event.queryStringParameters.q)
        || undefined
    }
    params = _.pickBy(params, _.identity)
    let promise = TagHandler.dispatchEvent(event.httpMethod, params)
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

  public static dispatchEvent (httpMethod: string, params: TagHandlerGetParams): Promise<any> {
    let api = new TagApi()

    // full fetch
    if (httpMethod === 'GET' && params.tag && !params.q) {
      let decodedTags = decodeURIComponent(params.tag)
      let tags: string[] = Utility.stringToArray(decodedTags)
      console.log(`[TagHandler::dispatchEvent()] fetch full entity. tags = ${JSON.stringify(tags)}`)
      return api.getTags(tags)
    }

    // query tags contains
    if (httpMethod === 'GET' && !params.tag && params.q) {
      let q = decodeURIComponent(params.q)
      console.log(`[TagHandler::dispatchEvent()] query tags = ${q}`)
      return api.searchTagContains(q)
    }
  }
}

export let main = TagHandler.handleRequest
