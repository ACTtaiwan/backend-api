import { Context, Callback, APIGatewayEvent } from 'aws-lambda'
import Response from '../../../libs/utils/Response'
import * as dbLib from '../../../libs/dbLib'
import * as mongoDbLib from '../../../libs/mongodbLib'
import * as _ from 'lodash'
import Utility from '../../../libs/utils/Utility';
import { MongoDbConfig } from '../../../config/mongodb'

export class BillCategoryApi {
  private tblBill: mongoDbLib.BillTable
  private tblCat: mongoDbLib.BillCategoryTable

  public async prefetchAll (): Promise<dbLib.BillCategoryEntity[]> {
    await this.init()
    return this.tblCat.getAllCategories()
  }

  public async fullFetch (idx: string[]): Promise<dbLib.BillCategoryEntity[]> {
    await this.init()
    return this.tblCat.getCategoriesById(idx)
  }

  public async fullFetchWithCongress (idx: string[], congress: number[]): Promise<dbLib.BillCategoryEntity[]> {
    await this.init()
    return this.tblCat.getCategoriesById(idx).then(cats => {
      let billIdx: string[] = []
      _.each(cats, x => billIdx = billIdx.concat(x.billId))
      billIdx = _.uniq(billIdx)
      if (billIdx.length === 0) {
        return cats
      } else {
        console.log(`[BillCategoryApi::fullFetchWithCongress()] query billIdx = ${JSON.stringify(billIdx, null, 2)}`)
        return this.tblBill.getBillsById(billIdx, 'id', 'congress').then(bills => {
          let billIdxCongressFiltered = _.map(_.filter(bills, b => _.includes(congress, b.congress)), 'id')
          _.each(cats, cat => cat.billId = _.intersection(cat.billId, billIdxCongressFiltered))
          return cats
        })
      }
    })
  }

  private async init () {
    if (!this.tblBill || !this.tblCat) {
      const db = await mongoDbLib.MongoDBManager.instance

      const tblBillName = MongoDbConfig.tableNames.BILLS_TABLE_NAME
      this.tblBill = db.getTable(tblBillName)

      const tblCatName = MongoDbConfig.tableNames.BILLCATEGORIES_TABLE_NAME
      this.tblCat = db.getTable(tblCatName)
    }
  }
}

/**
 *
 * BillCategoryHandler
 *
 */

class BillCategoryHandlerGetParams {
  id?: string
  congress?: string
}

class BillCategoryHandler {
  public static handleRequest (event: APIGatewayEvent, context: Context, callback?: Callback) {
    console.log(`[BillCategoryHandler::dispatchEvent()] event = ${JSON.stringify(event, null, 2)}`)

    // This freezes node event loop when callback is invoked
    context.callbackWaitsForEmptyEventLoop = false;

    let params = <BillCategoryHandlerGetParams> {
      id: (event.pathParameters && event.pathParameters.id)
       || (event.queryStringParameters && event.queryStringParameters.id)
       || undefined,
      congress: (event.queryStringParameters && event.queryStringParameters.congress) || undefined
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
    if (httpMethod === 'GET' && params.id && !params.congress) {
      let idx: string[] = Utility.stringToArray(params.id, _.identity)
      console.log(`[BillCategoryHandler::dispatchEvent()] fetch full entity. idx = ${JSON.stringify(idx)}`)
      return api.fullFetch(idx)
    }

    // full fetch + congress
    if (httpMethod === 'GET' && params.id && params.congress) {
      let idx: string[] = Utility.stringToArray(params.id, _.identity)
      let congress: number[] = Utility.stringToArray(params.congress, parseInt)
      console.log(`[BillCategoryHandler::dispatchEvent()] fetch full entity + congress.`)
      console.log(`idx = ${JSON.stringify(idx)}`)
      console.log(`congress = ${JSON.stringify(congress)}`)
      return api.fullFetchWithCongress(idx, congress)
    }
  }
}

export let main = BillCategoryHandler.handleRequest
