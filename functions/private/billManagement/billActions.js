import BillAction from '~/libs/bill/BillAction'
import Response from '~/libs/utils/Response'

class BillActionsHandler {
  constructor () {
    this.getPayload = this.getPayload.bind(this)
    this.getBillActions = this.getBillActions.bind(this)
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

  getBillActions (options) {
    return new Promise((resolve, reject) => {
      let billAction = new BillAction()
      billAction
        .getList(options)
        .then(response => resolve(response))
        .catch(error => reject(error))
    })
  }
}

export async function main (event, context, callback) {
  let billActionsHandler = new BillActionsHandler()

  billActionsHandler
    .getPayload({ event })
    .then(payload => billActionsHandler.getBillActions(payload))
    .then(response => {
      console.log('get bill actions success: ', JSON.stringify(response, null, 2))
      Response.success(callback, JSON.stringify(response), true)
    })
    .catch(error => {
      console.log('get bill actions error: ', JSON.stringify(error, null, 2))
      Response.error(callback, JSON.stringify('GET_BILL_ACTIONS_FAILED'), true)
    })
}
