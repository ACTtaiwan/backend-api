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
    return this.roleMngr.init()
      .then(() => this.roleMngr.getRolesById(id))
      .then(roles => this.sortAndFilter(roles))
  }

  public getRoleByPersonId (personId: string[]): Promise<dbLib.RoleEntity[]> {
    console.log(`[RoleApi::getRoleByPersonId()] personId = ${JSON.stringify(personId, null, 2)}`)
    return this.roleMngr.init()
      .then(() => this.roleMngr.getRolesByPersonId(personId))
      .then(roles => this.sortAndFilter(roles))
  }

  public getRoleBySearchPersonName (q: string): Promise<dbLib.RoleEntity[]> {
    console.log(`[RoleApi::getRoleBySearchPersonName()] q = ${q}`)
    return this.roleMngr.init()
      .then(() => this.roleMngr.searchPersonsWithNameContains(q, ['id']))
      .then(persons => {
        console.log(`[RoleApi::getRoleBySearchPersonName()] fetched persons = ${JSON.stringify(persons, null, 2)}`)
        let personIdx = _.map(persons, p => p.id)
        console.log(`[RoleApi::getRoleBySearchPersonName()] query roles by personIdx = ${JSON.stringify(personIdx, null, 2)}`)
        return personIdx
      })
      .then(personIdx => this.roleMngr.getRolesByPersonId(personIdx))
      .then(roles => this.sortAndFilter(roles))
  }

  public getRoleByStates (states: string[]): Promise<dbLib.RoleEntity[]> {
    console.log(`[RoleApi::getRoleById()] states = ${JSON.stringify(states, null, 2)}`)
    return this.roleMngr.init()
      .then(() => this.roleMngr.getRolesByState(states))
      .then(roles => this.sortAndFilter(roles))
  }

  public getRoleByCongress (congress: number[]): Promise<dbLib.RoleEntity[]> {
    console.log(`[RoleApi::getRoleByCongress()] congress = ${JSON.stringify(congress, null, 2)}`)
    return this.roleMngr.init()
      .then(() => this.roleMngr.getRolesByCongress(congress))
      .then(roles => this.sortAndFilter(roles))
  }

  public getRoleByStatesAndCongress (states: string[], congress: number[]): Promise<dbLib.RoleEntity[]> {
    console.log(`[RoleApi::getRoleByStatesAndCongress()] congress (${congress.length}) = ${JSON.stringify(congress, null, 2)}`)
    console.log(`[RoleApi::getRoleByStatesAndCongress()] states (${states.length}) = ${JSON.stringify(states, null, 2)}`)
    return this.roleMngr.init()
      .then(() => this.roleMngr.getRoleByStatesAndCongress(states, congress))
      .then(roles => this.sortAndFilter(roles))
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
  q?: string
}

export class RoleHandler {
  public static handleRequest (event: APIGatewayEvent, context: Context, callback?: Callback) {
    console.log(`[RoleHandler::handleRequest()] event = ${JSON.stringify(event, null, 2)}`)

    // This freezes node event loop when callback is invoked
    context.callbackWaitsForEmptyEventLoop = false;

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
        || undefined,
      q:
           (event.pathParameters && event.pathParameters.q)
        || (event.queryStringParameters && event.queryStringParameters.q)
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
    if (httpMethod === 'GET' && params.id && !params.congress && !params.states && !params.personId && !params.q) {
      let idx: string[] = Utility.stringToArray(params.id)
      console.log(`[RoleHandler::dispatchEvent()] fetch full entity. idx = ${JSON.stringify(idx)}`)
      return api.getRoleById(idx)
    }

    // person Id
    if (httpMethod === 'GET' && !params.id && !params.congress && !params.states && params.personId && !params.q) {
      let personId: string[] = Utility.stringToArray(params.personId)
      console.log(`[RoleHandler::dispatchEvent()] fetch full entity by personId. personId = ${JSON.stringify(personId)}`)
      return api.getRoleByPersonId(personId)
    }

    // person Q (search)
    if (httpMethod === 'GET' && !params.id && !params.congress && !params.states && !params.personId && params.q) {
      let nameSearch = decodeURIComponent(params.q)
      console.log(`[RoleHandler::dispatchEvent()] fetch full entity by person name search. Q = ${JSON.stringify(nameSearch)}`)
      return api.getRoleBySearchPersonName(nameSearch)
    }

    // congress
    if (httpMethod === 'GET' && !params.id && params.congress && !params.states && !params.personId && !params.q) {
      let congress: number[] = Utility.stringToArray(params.congress, parseInt)
      console.log(`[RoleHandler::dispatchEvent()] fetch full entity by congress.`)
      console.log(`[RoleHandler::dispatchEvent()] congress = ${JSON.stringify(congress)}`)
      return api.getRoleByCongress(congress)
    }

    // state
    if (httpMethod === 'GET' && !params.id && !params.congress && params.states && !params.personId && !params.q) {
      let states: string[] = Utility.stringToArray(params.states)
      console.log(`[RoleHandler::dispatchEvent()] fetch full entity by states.`)
      console.log(`[RoleHandler::dispatchEvent()] states = ${JSON.stringify(states)}`)
      return api.getRoleByStates(states)
    }

    // state + congress
    if (httpMethod === 'GET' && !params.id && params.congress && params.states && !params.personId && !params.q) {
      let congress: number[] = Utility.stringToArray(params.congress, parseInt)
      let states: string[] = Utility.stringToArray(params.states)
      console.log(`[RoleHandler::dispatchEvent()] fetch full entity by congress + states.`)
      console.log(`[RoleHandler::dispatchEvent()] congress = ${JSON.stringify(congress)}`)
      console.log(`[RoleHandler::dispatchEvent()] states = ${JSON.stringify(states)}`)
      return api.getRoleByStatesAndCongress(states, congress)
    }
  }
}

export let main = RoleHandler.handleRequest
