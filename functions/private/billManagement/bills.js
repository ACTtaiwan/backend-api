import BillDirectory from '~/libs/bill/Directory'
import Response from '~/libs/utils/Response'

class BillsHandler {
  constructor () {
    this._billDirectory = new BillDirectory()
    this.getPayload = this.getPayload.bind(this)
    this.getBills = this.getBills.bind(this)
    this.createBill = this.createBill.bind(this)
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

  getBills (options) {
    return new Promise((resolve, reject) => {
      this._billDirectory
        .getBills(options)
        .then(response => resolve(response))
        .catch(error => reject(error))
    })
  }

  createBill (options) {
    return new Promise((resolve, reject) => {
      this._billDirectory
        .createBill(options)
        .then(response => resolve(response))
        .catch(error => reject(error))
    })
  }
}

export async function main (event, context, callback) {
  let billsHandler = new BillsHandler()

  billsHandler
    .getPayload({ event })
    .then(payload => {
      const action = {
        POST: 'getBills',
        GET: 'getBills',
        PUT: 'createBill'
      }[event.httpMethod]

      return billsHandler[action](payload)
    })
    .then(response => {
      console.log('get bills success: ', JSON.stringify(response, null, 2))
      Response.success(callback, JSON.stringify(response), true)
    })
    .catch(error => {
      console.log('get bills error: ', JSON.stringify(error, null, 2))
      Response.error(callback, JSON.stringify('GET_BILLS_FAILED'), true)
    })
}
