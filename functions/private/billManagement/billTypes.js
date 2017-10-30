import BillType from '~/libs/bill/BillType'
import Response from '~/libs/utils/Response'

class BillTypesHandler {
  constructor () {
    this.getPayload = this.getPayload.bind(this)
    this.getBillTypes = this.getBillTypes.bind(this)
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

  getBillTypes (options) {
    return new Promise((resolve, reject) => {
      let billType = new BillType()
      billType
        .getList(options)
        .then(response => resolve(response))
        .catch(error => reject(error))
    })
  }
}

export async function main (event, context, callback) {
  let billTypesHandler = new BillTypesHandler()

  billTypesHandler
    .getPayload({ event })
    .then(payload => billTypesHandler.getBillTypes(payload))
    .then(response => {
      console.log('get bill types success: ', JSON.stringify(response, null, 2))
      Response.success(callback, JSON.stringify(response), true)
    })
    .catch(error => {
      console.log('get bill types error: ', JSON.stringify(error, null, 2))
      Response.error(callback, JSON.stringify('GET_BILL_TYPES_FAILED'), true)
    })
}
