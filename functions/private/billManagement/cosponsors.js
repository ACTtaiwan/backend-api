import BillDirectory from '~/libs/bill/Directory'
import Response from '~/libs/utils/Response'

class CosponsorsHandler {
  constructor () {
    this._billDirectory = new BillDirectory()
    this.getPayload = this.getPayload.bind(this)
    this.updateCosponsors = this.updateCosponsors.bind(this)
  }

  getPayload (options) {
    return new Promise((resolve, reject) => {
      try {
        let payload = JSON.parse(options.event.body)
        resolve(payload)
      } catch (error) {
        reject(error)
      }
    })
  }

  updateCosponsors (options) {
    return new Promise((resolve, reject) => {
      this._billDirectory
        .updateCosponsors(options)
        .then(response => resolve(response))
        .catch(error => reject(error))
    })
  }
}

export async function main (event, context, callback) {
  let cosponsorsHandler = new CosponsorsHandler()

  cosponsorsHandler
    .getPayload({ event })
    .then(payload => cosponsorsHandler.updateCosponsors(payload))
    .then(response => {
      console.log('update cosponsors success: ', JSON.stringify(response, null, 2))
      Response.success(callback, JSON.stringify(response), true)
    })
    .catch(error => {
      console.log('update cosponsors error: ', JSON.stringify(error, null, 2))
      Response.error(callback, JSON.stringify('UPDATE_COSPONSORS_FAILED'), true)
    })
}
