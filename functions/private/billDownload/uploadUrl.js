import BillDirectory from '~/libs/bill/Directory'
import Response from '~/libs/utils/Response'

class BillsHandler {
  constructor () {
    this.getPayload = this.getPayload.bind(this)
    this.getBillUploadUrl = this.getBillUploadUrl.bind(this)
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

  getBillUploadUrl (options) {
    return new Promise((resolve, reject) => {
      let billDirectory = new BillDirectory()
      billDirectory
        .getBillUploadUrl(options)
        .then(response => resolve(response))
        .catch(error => reject(error))
    })
  }
}

export async function main (event, context, callback) {
  let billsHandler = new BillsHandler()

  billsHandler
    .getPayload({ event })
    .then(payload => billsHandler.getBillUploadUrl(payload))
    .then(response => {
      console.log('get bill upload url success: ', JSON.stringify(response, null, 2))
      Response.success(callback, JSON.stringify(response), true)
    })
    .catch(error => {
      console.log('get bill upload url error: ', JSON.stringify(error, null, 2))
      Response.error(callback, JSON.stringify('GET_UPLOAD_URL_FAILED'), true)
    })
}
