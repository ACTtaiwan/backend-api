import { Context, Callback, APIGatewayEvent } from 'aws-lambda'
import Response from '../../../libs/utils/Response'
import * as dbLib from '../../../libs/dbLib/DbLib'
import * as awsConfig from '../../../config/aws.json'
import * as _ from 'lodash'
import Utility from '../../../libs/utils/Utility';

export class BillCategoryApi {
  private readonly db = dbLib.DynamoDBManager.instance()
  private readonly tblName = (<any> awsConfig).dynamodb.VOLUNTEER_BILLCATEGORIES_TABLE_NAME
  private readonly tbl = <dbLib.BillCategoryTable> this.db.getTable(this.tblName)

  public async prefetchAll (): Promise<dbLib.BillCategoryEntity[]> {
    return this.tbl.getAllCategories()
  }

  public async fullFetch (idx: string[]): Promise<dbLib.BillCategoryEntity[]> {
    return this.tbl.getCategoriesById(idx)
  }
}

/**
 *
 * BillCategoryHandler
 *
 */

class BillCategoryHandlerGetParams {
  id?: string
}

class BillCategoryHandler {
  public static handleRequest (event: APIGatewayEvent, context: Context, callback?: Callback) {
    console.log(`[BillCategoryHandler::dispatchEvent()] event = ${JSON.stringify(event, null, 2)}`)
    let params = <BillCategoryHandlerGetParams> {
      id: (event.pathParameters && event.pathParameters.id)
       || (event.queryStringParameters && event.queryStringParameters.id)
       || undefined
    }
    params = _.pickBy(params, _.identity)
    let promise = BillCategoryHandler.dispatchEvent(event.httpMethod, params)
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

  private static dispatchEvent (httpMethod: string, params: BillCategoryHandlerGetParams): Promise<any> {
    let api = new BillCategoryApi()

    // pre-fetch
    if (httpMethod === 'GET' && _.isEmpty(params)) {
      console.log(`[BillCategoryHandler::dispatchEvent()] pre-fetch all`)
      return api.prefetchAll()
    }

    // full fetch
    if (httpMethod === 'GET' && params.id) {
      let idx: string[] = Utility.stringToArray(params.id, _.identity)
      console.log(`[BillCategoryHandler::dispatchEvent()] fetch full entity. idx = ${JSON.stringify(idx)}`)
      return api.fullFetch(idx)
    }
  }
}

export let main = BillCategoryHandler.handleRequest
