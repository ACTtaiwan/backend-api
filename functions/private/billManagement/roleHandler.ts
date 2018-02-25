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
    return this.roleMngr.getRolesById(id).then(roles => this.sortAndFilter(roles))
  }

  public getRoleByPersonId (personId: string[]): Promise<dbLib.RoleEntity[]> {
    console.log(`[RoleApi::getRoleByPersonId()] personId = ${JSON.stringify(personId, null, 2)}`)
    return this.roleMngr.getRolesByPersonId(personId).then(roles => this.sortAndFilter(roles))
  }

  public getRoleByStates (states: string[]): Promise<dbLib.RoleEntity[]> {
    console.log(`[RoleApi::getRoleById()] states = ${JSON.stringify(states, null, 2)}`)
    let promises: Promise<dbLib.RoleEntity[]>[] = []
    _.each(states, st => promises.push(this.roleMngr.getRolesByState(st)))
    return Promise.all(promises).then(results => {
      let roles = _.keyBy(_.flatten(results), 'id')
      return this.sortAndFilter(_.values(roles))
    })
  }

  public getRoleByCongress (congress: number[]): Promise<dbLib.RoleEntity[]> {
    console.log(`[RoleApi::getRoleByCongress()] congress = ${JSON.stringify(congress, null, 2)}`)
    let promises: Promise<dbLib.RoleEntity[]>[] = []
    _.each(congress, cngr => promises.push(this.roleMngr.getRolesByCongress(cngr)))
    return Promise.all(promises)
      .then(results => _.flatten(results))
      .then(roles => this.sortAndFilter(roles))
  }

  public getRoleByStatesAndCongress (states: string[], congress: number[]): Promise<dbLib.RoleEntity[]> {
    console.log(`[RoleApi::getRoleByStatesAndCongress()] congress = ${JSON.stringify(congress, null, 2)}`)
    console.log(`[RoleApi::getRoleByStatesAndCongress()] states = ${JSON.stringify(states, null, 2)}`)
    if (states.length === 1 && congress.length ===  1) {
      console.log(`[RoleApi::getRoleByStatesAndCongress()] state.length == 1 && congress.length == 1`)
      return this.roleMngr.getRolesByState(states[0], congress[0])
          .then(roles => this.sortAndFilter(roles))
    } else if (congress.length < states.length) {
      console.log(`[RoleApi::getRoleByStatesAndCongress()] congress.length (${congress.length}) < states.length (${states.length})`)
      return this.getRoleByCongress(congress)
        .then(roles => _.filter(roles, r => _.includes(states, r.state)))
        .then(roles => this.sortAndFilter(roles))
    } else {
      console.log(`[RoleApi::getRoleByStatesAndCongress()] congress.length (${congress.length}) >= states.length (${states.length})`)
      return this.getRoleByStates(states)
        .then(roles => _.filter(roles, r => _.intersection(congress, r.congressNumbers).length > 0))
        .then(roles => this.sortAndFilter(roles))
    }
  }

  private sortAndFilter (roles: dbLib.RoleEntity[]): dbLib.RoleEntity[] {
    return _.orderBy(roles,
      ['state', (role: dbLib.RoleEntity) => role.district || 0, (role: dbLib.RoleEntity) => role.senatorClass],
      ['asec', 'asec', 'asec'])
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
  personId?: string
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
        || undefined,
      personId:
           (event.pathParameters && event.pathParameters.personId)
        || (event.queryStringParameters && event.queryStringParameters.personId)
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
    if (httpMethod === 'GET' && params.id && !params.congress && !params.states && !params.personId) {
      let idx: string[] = Utility.stringToArray(params.id)
      console.log(`[RoleHandler::dispatchEvent()] fetch full entity. idx = ${JSON.stringify(idx)}`)
      return api.getRoleById(idx)
    }

    // person Id
    if (httpMethod === 'GET' && !params.id && !params.congress && !params.states && params.personId) {
      let personId: string[] = Utility.stringToArray(params.personId)
      console.log(`[RoleHandler::dispatchEvent()] fetch full entity by personId. personId = ${JSON.stringify(personId)}`)
      return api.getRoleByPersonId(personId)
    }

    // congress
    if (httpMethod === 'GET' && !params.id && params.congress && !params.states && !params.personId) {
      let congress: number[] = Utility.stringToArray(params.congress, parseInt)
      console.log(`[BillCategoryHandler::dispatchEvent()] fetch full entity by congress.`)
      console.log(`[BillCategoryHandler::dispatchEvent()] congress = ${JSON.stringify(congress)}`)
      return api.getRoleByCongress(congress)
    }

    // state
    if (httpMethod === 'GET' && !params.id && !params.congress && params.states && !params.personId) {
      let states: string[] = Utility.stringToArray(params.states)
      console.log(`[BillCategoryHandler::dispatchEvent()] fetch full entity by states.`)
      console.log(`[BillCategoryHandler::dispatchEvent()] states = ${JSON.stringify(states)}`)
      return api.getRoleByStates(states)
    }

    // state + congress
    if (httpMethod === 'GET' && !params.id && params.congress && params.states && !params.personId) {
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
