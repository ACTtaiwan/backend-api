import { Context, Callback, APIGatewayEvent } from 'aws-lambda'
import Response from '../../../libs/utils/Response'
import Utility from '../../../libs/utils/Utility'
import * as dbLib from '../../../libs/dbLib'
import * as awsConfig from '../../../config/aws.json'
import * as _ from 'lodash'
import { BillCategoryApi } from './billCategoryHandler';

// queryBills()

export interface QueryBillsRequest {
  congress?: number[]
  categoryIdx?: string[]
  sponsorRoleId?: string[]
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
    let queryAttrs: (keyof dbLib.BillEntity)[] = ['id', 'introducedDate']
    if (req.categoryIdx) {
      console.log(`[BillApi::queryBills()] Redirect to category api. req.categoryIdx = ${JSON.stringify(req.categoryIdx)}`)
      let catApi = new BillCategoryApi()
      let promise = req.congress ? catApi.fullFetchWithCongress(req.categoryIdx, req.congress) : catApi.fullFetch(req.categoryIdx)
      return promise.then(cats => {
        let billIdx: string[] = []
        _.each(cats, x => billIdx = billIdx.concat(x.billId))
        billIdx = _.uniq(billIdx)
        if (billIdx.length === 0) {
          return []
        } else {
          return this.tbl.getBillsById(billIdx, ...queryAttrs).then(bills => {
            let rtn = this.sortAndFilter(req, bills, queryAttrs)
            return _.map(rtn, x => x.id)
          })
        }
      })
    }
    // if (req.categoryIdx) {
    //   queryAttrs.push('categories')
    // }
    if (req.sponsorRoleId) {
      queryAttrs.push(<any> 'sponsor.id')
    }
    if (!req.congress) {
      out = this.tbl.getAllBills(...queryAttrs).then(out => {
        let rtn = this.sortAndFilter(req, out, queryAttrs)
        return _.map(rtn, x => x.id)
      })
    } else {
      let promises: Promise<dbLib.BillEntity[]>[] = []
      _.each(req.congress, congress => {
        let p = this.tbl.queryBillsByCongress(congress, queryAttrs).then(out => out.results)
        promises.push(p)
      })
      out = Promise.all(promises).then(results => {
        let combined = _.concat<dbLib.BillEntity>([], ...results)
        let rtn = this.sortAndFilter(req, combined, queryAttrs)
        return _.map(rtn, x => x.id)
      })
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

  private sortAndFilter (req: QueryBillsRequest, results: dbLib.BillEntity[], queryAttrs: (keyof dbLib.BillEntity)[]): dbLib.BillEntity[] {
    if (req.categoryIdx && req.categoryIdx.length > 0 && queryAttrs && _.includes(queryAttrs, 'categories')) {
      results = _.filter(results, bill =>
        (bill.categories && bill.categories.length > 0) ?
          !!_.find(bill.categories, cat => _.includes(req.categoryIdx, cat.id)) : false
      )
    }
    results = _.orderBy(results, ['introducedDate'], ['desc'])
    return results
  }
}

/**
 *
 * BillHandler
 *
 */

class BillHandlerGetParams {
  congress?: string
  categoryIdx?: string
  attrNamesToGet?: string
  id?: string
}

class BillHandler {
  public static handleRequest (event: APIGatewayEvent, context: Context, callback?: Callback) {
    console.log(`[BillHandler::handleRequest()] event = ${JSON.stringify(event, null, 2)}`)
    let params = <BillHandlerGetParams> {
      congress: (event.queryStringParameters && event.queryStringParameters.congress) || undefined,
      categoryIdx: (event.queryStringParameters && event.queryStringParameters.categoryIdx) || undefined,
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

    // pre-fetch
    if (httpMethod === 'GET' && (params.congress || _.isEmpty(params))) {
      let req: QueryBillsRequest = {}
      if (params.congress) {
        req.congress = Utility.stringToArray(params.congress, parseInt)
      }
      if (params.categoryIdx) {
        req.categoryIdx = Utility.stringToArray(params.categoryIdx)
      }
      console.log(`[BillHandler::dispatchEvent()] request = ${JSON.stringify(req, null, 2)}`)
      return api.queryBills(req)
    }

    // full fetch
    if (httpMethod === 'GET' && params.id) {
      let req: GetBillByIdRequest = {
        id: Utility.stringToArray(params.id)
      }

      if (params.attrNamesToGet) {
        req.attrNamesToGet = Utility.stringToArray(params.attrNamesToGet)
      }

      console.log(`[BillHandler::dispatchEvent()] request = ${JSON.stringify(req, null, 2)}`)
      return api.getBillById(req)
    }
  }
}

export let main = BillHandler.handleRequest
