import BillVersion from '~/libs/bill/BillVersion'
import Response from '~/libs/utils/Response'

class BillVersionsHandler {
  constructor () {
    this.getPayload = this.getPayload.bind(this)
    this.getBillVersions = this.getBillVersions.bind(this)
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

  getBillVersions (options) {
    return new Promise((resolve, reject) => {
      let billVersion = new BillVersion()
      billVersion
        .getList(options)
        .then(response => resolve(response))
        .catch(error => reject(error))
    })
  }
}

export async function main (event, context, callback) {
  let billVersionsHandler = new BillVersionsHandler()

  billVersionsHandler
    .getPayload({ event })
    .then(payload => billVersionsHandler.getBillVersions(payload))
    .then(response => {
      console.log('get bill versions success: ', JSON.stringify(response, null, 2))
      Response.success(callback, JSON.stringify(response), true)
    })
    .catch(error => {
      console.log('get bill versions error: ', JSON.stringify(error, null, 2))
      Response.error(callback, JSON.stringify('GET_BILL_VERSIONS_FAILED'), true)
    })
}
