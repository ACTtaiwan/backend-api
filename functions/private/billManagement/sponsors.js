import Role from '~/libs/member/Role'
import Response from '~/libs/utils/Response'

class SponsorsHandler {
  constructor () {
    this.getPayload = this.getPayload.bind(this)
    this.getRoles = this.getRoles.bind(this)
    this.getRole = this.getRole.bind(this)
  }

  getPayload (options) {
    return new Promise((resolve, reject) => {
      try {
        let payload = JSON.parse(options.event.body)
        resolve(payload || {})
      } catch (error) {
        reject(error)
      }
    })
  }

  getRole (options) {
    return new Promise((resolve, reject) => {
      let role = new Role()
      role
        .getRole(options)
        .then(response => resolve(response))
        .catch(error => reject(error))
    })
  }

  getRoles (options) {
    return new Promise((resolve, reject) => {
      let role = new Role()
      role
        .getRoles(options)
        .then(response => resolve(response))
        .catch(error => reject(error))
    })
  }
}

export async function main (event, context, callback) {
  let sponsorsHandler = new SponsorsHandler()

  sponsorsHandler
    .getPayload({ event })
    .then(payload => {
      if (event.httpMethod === 'GET' && !event.pathParameters) {
        return sponsorsHandler.getRoles(payload)
      }
      if (event.httpMethod === 'GET' && event.pathParameters) {
        return sponsorsHandler.getRole({ id: event.pathParameters.id })
      }
      if (event.httpMethod === 'POST') {
        return sponsorsHandler.getRoles(payload)
      }
    })
    .then(response => {
      console.log('get sponsors success: ', JSON.stringify(response, null, 2))
      Response.success(callback, JSON.stringify(response), true)
    })
    .catch(error => {
      console.log('get sponsors error: ', JSON.stringify(error, null, 2))
      Response.error(callback, JSON.stringify('GET_SPONSORS_FAILED'), true)
    })
}
