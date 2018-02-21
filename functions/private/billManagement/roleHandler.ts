import { Context, Callback, APIGatewayEvent } from 'aws-lambda'
import Response from '../../../libs/utils/Response'
import * as dbLib from '../../../libs/dbLib'
import { RoleManager } from '../../../libs/dataManager/RoleManager'
import * as _ from 'lodash'
import Utility from '../../../libs/utils/Utility';

export class RoleApi {
  private readonly roleMngr = new RoleManager()

  public getRoleById (id: string[]): Promise<dbLib.RoleEntity[]> {
    console.log(`[RoleApi::getRoleById()] id = ${JSON.stringify(id, null, 2)}`)
    return this.roleMngr.getRolesById(id)
  }

  public getRoleByStates (states: string[]): Promise<dbLib.RoleEntity[]> {
    console.log(`[RoleApi::getRoleById()] states = ${JSON.stringify(states, null, 2)}`)
    let promises: Promise<dbLib.RoleEntity[]>[] = []
    _.each(states, st => promises.push(this.roleMngr.getRolesByState(st)))
    return Promise.all(promises).then(results => {
      let roles = _.keyBy(_.flatten(results), 'id')
      return _.values(roles)
    })
  }

  public getRoleByCongress (congress: number[]): Promise<dbLib.RoleEntity[]> {
    console.log(`[RoleApi::getRoleByCongress()] congress = ${JSON.stringify(congress, null, 2)}`)
    let promises: Promise<dbLib.RoleEntity[]>[] = []
    _.each(congress, cngr => promises.push(this.roleMngr.getRolesByCongress(cngr)))
    return Promise.all(promises).then(results => _.flatten(results))
  }

  public getRoleByStatesAndCongress (states: string[], congress: number[]): Promise<dbLib.RoleEntity[]> {
    console.log(`[RoleApi::getRoleByStatesAndCongress()] congress = ${JSON.stringify(congress, null, 2)}`)
    console.log(`[RoleApi::getRoleByStatesAndCongress()] states = ${JSON.stringify(states, null, 2)}`)
    if (states.length === 1 && congress.length ===  1) {
      console.log(`[RoleApi::getRoleByStatesAndCongress()] state.length == 1 && congress.length == 1`)
      return this.roleMngr.getRolesByState(states[0], congress[0])
    } else if (congress.length < states.length) {
      console.log(`[RoleApi::getRoleByStatesAndCongress()] congress.length (${congress.length}) < states.length (${states.length})`)
      return this.getRoleByCongress(congress).then(roles => _.filter(roles, r => _.includes(states, r.state)))
    } else {
      console.log(`[RoleApi::getRoleByStatesAndCongress()] congress.length (${congress.length}) >= states.length (${states.length})`)
      return this.getRoleByStates(states).then(roles => _.filter(roles, r => _.intersection(congress, r.congressNumbers).length > 0))
    }
  }
}

/**
 *
 * BillCategoryHandler
 *
 */

export class RoleHandlerGetParams {
  id?: string
  congress?: string
  states?: string
}

export class RoleHandler {
  public static handleRequest (event: APIGatewayEvent, context: Context, callback?: Callback) {
    console.log(`[RoleHandler::handleRequest()] event = ${JSON.stringify(event, null, 2)}`)
    let params: RoleHandlerGetParams = {
      id:
           (event.pathParameters && event.pathParameters.id)
        || (event.queryStringParameters && event.queryStringParameters.id)
        || undefined,
      congress:
           (event.pathParameters && event.pathParameters.congress)
        || (event.queryStringParameters && event.queryStringParameters.congress)
        || undefined,
      states:
           (event.pathParameters && event.pathParameters.state)
        || (event.queryStringParameters && event.queryStringParameters.state)
        || undefined
    }
    params = _.pickBy(params, _.identity)
    let promise = RoleHandler.dispatchEvent(event.httpMethod, params)
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

  public static dispatchEvent (httpMethod: string, params: RoleHandlerGetParams): Promise<dbLib.RoleEntity[]> {
    let api = new RoleApi()

    // full fetch
    if (httpMethod === 'GET' && params.id && !params.congress && !params.states) {
      let idx: string[] = Utility.stringToArray(params.id)
      console.log(`[RoleHandler::dispatchEvent()] fetch full entity. idx = ${JSON.stringify(idx)}`)
      return api.getRoleById(idx)
    }

    // congress
    if (httpMethod === 'GET' && !params.id && params.congress && !params.states) {
      let congress: number[] = Utility.stringToArray(params.congress, parseInt)
      console.log(`[BillCategoryHandler::dispatchEvent()] fetch full entity by congress.`)
      console.log(`[BillCategoryHandler::dispatchEvent()] congress = ${JSON.stringify(congress)}`)
      return api.getRoleByCongress(congress)
    }

    // state
    if (httpMethod === 'GET' && !params.id && !params.congress && params.states) {
      let states: string[] = Utility.stringToArray(params.states)
      console.log(`[BillCategoryHandler::dispatchEvent()] fetch full entity by states.`)
      console.log(`[BillCategoryHandler::dispatchEvent()] states = ${JSON.stringify(states)}`)
      return api.getRoleByStates(states)
    }

    // state + congress
    if (httpMethod === 'GET' && !params.id && params.congress && params.states) {
      let congress: number[] = Utility.stringToArray(params.congress, parseInt)
      let states: string[] = Utility.stringToArray(params.states)
      console.log(`[BillCategoryHandler::dispatchEvent()] fetch full entity by congress + states.`)
      console.log(`[BillCategoryHandler::dispatchEvent()] congress = ${JSON.stringify(congress)}`)
      console.log(`[BillCategoryHandler::dispatchEvent()] states = ${JSON.stringify(states)}`)
      return api.getRoleByStatesAndCongress(states, congress)
    }
  }
}

export let main = RoleHandler.handleRequest
