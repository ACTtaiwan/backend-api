import { Context, Callback, APIGatewayEvent } from 'aws-lambda'
import Response from '../../../libs/utils/Response'
import Utility from '../../../libs/utils/Utility'
import * as dbLib from '../../../libs/dbLib/DbLib'
import * as awsConfig from '../../../config/aws.json'
import * as _ from 'lodash'

// queryBills()

export interface QueryBillsRequest {
  congress?: number[]
  categories?: string[]
}

export type QueryBillsResponse = string[]

// getBillById()

export interface GetBillByIdRequest {
  id: string[],
  attrNamesToGet?: (keyof dbLib.BillEntity)[]
}

export type GetBillByIdResponse = dbLib.BillEntity[]

export class BillApi {
  private readonly db = dbLib.DynamoDBManager.instance()
  private readonly tblName = (<any> awsConfig).dynamodb.VOLUNTEER_BILLS_TABLE_NAME
  private readonly tbl = <dbLib.BillTable> this.db.getTable(this.tblName)

  public async queryBills (req: QueryBillsRequest): Promise<QueryBillsResponse> {
    let out: Promise<QueryBillsResponse>
    if (!req.congress) {
      out = this.tbl.getAllBills('id').then(out => _.map(out, x => x.id))
    } else {
      let promises: Promise<QueryBillsResponse>[] = []
      _.each(req.congress, congress => {
        let p = this.tbl.queryBillsByCongress(congress, ['id']).then(out => _.map(out.results, x => x.id))
        promises.push(p)
      })
      out = Promise.all(promises).then(results => _.concat<string>([], ...results))
    }
    return out
  }

  public async getBillById (req: GetBillByIdRequest): Promise<GetBillByIdResponse> {
    let attrNamesToGet = req.attrNamesToGet || []
    if (req.id && req.id.length === 1) {
      return this.tbl.getBillById(req.id[0], ...attrNamesToGet).then(out => [out])
    } else {
      return this.tbl.getBillsById(req.id, ...attrNamesToGet)
    }
  }
}

/**
 *
 * BillHandler
 *
 */

class BillHandlerGetParams {
  congress?: string
  attrNamesToGet?: string
  id?: string
}

class BillHandler {
  public static handleRequest (event: APIGatewayEvent, context: Context, callback?: Callback) {
    console.log(`[CongressGovHandler::BillHandler()] event = ${JSON.stringify(event, null, 2)}`)
    let params = <BillHandlerGetParams> {
      congress: (event.queryStringParameters && event.queryStringParameters.congress) || undefined,
      attrNamesToGet: (event.queryStringParameters && event.queryStringParameters.attrNamesToGet) || undefined,
      id: (event.pathParameters && event.pathParameters.id)
       || (event.queryStringParameters && event.queryStringParameters.id)
       || undefined
    }
    params = _.pickBy(params, _.identity)
    let promise = BillHandler.dispatchEvent(event.httpMethod, params)
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

  private static dispatchEvent (httpMethod: string, params: BillHandlerGetParams): Promise<any> {
    let api = new BillApi()

    if (httpMethod === 'GET' && (params.congress || _.isEmpty(params))) {
      let req: QueryBillsRequest = {}
      if (params.congress) {
        req.congress = BillHandler.stringToArray(params.congress, parseInt)
      }
      console.log(`[CongressGovHandler::BillHandler()] request = ${JSON.stringify(req, null, 2)}`)
      return api.queryBills(req)
    }

    if (httpMethod === 'GET' && params.id) {
      let req: GetBillByIdRequest = {
        id: BillHandler.stringToArray(params.id)
      }

      if (params.attrNamesToGet) {
        req.attrNamesToGet = BillHandler.stringToArray(params.attrNamesToGet)
      }

      console.log(`[CongressGovHandler::BillHandler()] request = ${JSON.stringify(req, null, 2)}`)
      return api.getBillById(req)
    }
  }

  private static stringToArray<T> (str: string, postConvert: (x: string) => T = _.identity): T[] {
    let arr = _.filter(str.trim().split(','), x => x)
    let rtn = _.map(arr, x => postConvert(x.trim()))
    return rtn
  }
}

export let main = BillHandler.handleRequest
