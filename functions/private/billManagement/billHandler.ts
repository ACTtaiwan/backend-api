import { Context, Callback, APIGatewayEvent } from 'aws-lambda'
import Response from '../../../libs/utils/Response'
import Utility from '../../../libs/utils/Utility'
import * as dbLib from '../../../libs/dbLib'
import * as mongoDbLib from '../../../libs/mongodbLib'
import * as _ from 'lodash'
import { BillCategoryApi } from './billCategoryHandler';
import { MongoDbConfig } from '../../../config/mongodb'

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


export interface SearchBillsRequest {
  q: string
  congress?: number[]
  attrNamesToGet?: (keyof dbLib.BillEntity)[]
}

export type SearchBillsResponse = dbLib.BillEntity[]

export class BillApi {
  private tbl: mongoDbLib.BillTable

  public async queryBills (req: QueryBillsRequest): Promise<QueryBillsResponse> {
    await this.init()
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

    let query = {}

    if (req.congress) {
      if (req.congress.length === 1 && req.congress[0]) {
        query['congress'] = req.congress[0]
      } else {
        query['congress'] = { $in: req.congress }
      }
    }

    if (req.sponsorRoleId) {
      if (req.sponsorRoleId.length === 1 && req.sponsorRoleId[0]) {
        query['sponsorRoleId'] = req.sponsorRoleId[0]
      } else {
        query['sponsorRoleId'] = { $in: req.sponsorRoleId }
      }
    }

    let results = await this.tbl.getBillsByMongoQuery(query, queryAttrs)
    results = this.sortAndFilter(req, results, queryAttrs)
    let out: QueryBillsResponse = _.map(results, x => x.id)
    return out
  }

  public async getBillById (req: GetBillByIdRequest): Promise<GetBillByIdResponse> {
    await this.init()
    let attrNamesToGet = req.attrNamesToGet || []
    if (req.id && req.id.length === 1) {
      return this.tbl.getBillById(req.id[0], ...attrNamesToGet).then(out => [out])
    } else {
      return this.tbl.getBillsById(req.id, ...attrNamesToGet)
    }
  }

  public async searchBills (req: SearchBillsRequest): Promise<SearchBillsResponse> {
    await this.init()
    let attrNamesToGet: (keyof dbLib.BillEntity)[] =
         req.attrNamesToGet
      || ['id', 'title', 'title_zh', 'billNumber', 'billType', 'congress']
    attrNamesToGet.push('introducedDate')
    attrNamesToGet = _.uniq(attrNamesToGet)
    return this.tbl.searchBills(req.q, attrNamesToGet, null, req.congress)
      .then(bills =>  _.orderBy(bills, ['introducedDate'], ['desc']))
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

  private async init () {
    if (!this.tbl) {
      const db = await mongoDbLib.MongoDBManager.instance
      const tblBillName = MongoDbConfig.tableNames.BILLS_TABLE_NAME
      this.tbl = db.getTable(tblBillName)
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
  categoryIdx?: string
  attrNamesToGet?: string
  id?: string
  q?: string
}

class BillHandler {
  public static handleRequest (event: APIGatewayEvent, context: Context, callback?: Callback) {
    console.log(`[BillHandler::handleRequest()] event = ${JSON.stringify(event, null, 2)}`)

    // This freezes node event loop when callback is invoked
    context.callbackWaitsForEmptyEventLoop = false;

    let params = <BillHandlerGetParams> {
      congress: (event.queryStringParameters && event.queryStringParameters.congress) || undefined,
      categoryIdx: (event.queryStringParameters && event.queryStringParameters.categoryIdx) || undefined,
      attrNamesToGet: (event.queryStringParameters && event.queryStringParameters.attrNamesToGet) || undefined,
      id: (event.pathParameters && event.pathParameters.id)
       || (event.queryStringParameters && event.queryStringParameters.id)
       || undefined,
      q:  (event.pathParameters && event.pathParameters.q)
       || (event.queryStringParameters && event.queryStringParameters.q)
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
    if (httpMethod === 'GET' && (params.congress || _.isEmpty(params)) && !params.q) {
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
    if (httpMethod === 'GET' && params.id && !params.q) {
      let req: GetBillByIdRequest = {
        id: Utility.stringToArray(params.id)
      }

      if (params.attrNamesToGet) {
        req.attrNamesToGet = Utility.stringToArray(params.attrNamesToGet)
      }

      console.log(`[BillHandler::dispatchEvent()] request = ${JSON.stringify(req, null, 2)}`)
      return api.getBillById(req)
    }

    // search bills
    if (httpMethod === 'GET' && params.q) {
      let req: SearchBillsRequest = {
        q: params.q
      }

      if (params.congress) {
        req.congress = Utility.stringToArray(params.congress, parseInt)
      }

      if (params.attrNamesToGet) {
        req.attrNamesToGet = Utility.stringToArray(params.attrNamesToGet)
      }

      console.log(`[BillHandler::dispatchEvent()] request = ${JSON.stringify(req, null, 2)}`)
      return api.searchBills(req)
    }
  }
}

export let main = BillHandler.handleRequest
