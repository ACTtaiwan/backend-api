import BillDirectory from '~/libs/bill/Directory'
import Response from '~/libs/utils/Response'

class AddBillCategoryHandler {
  constructor () {
    this.getPayload = this.getPayload.bind(this)
    this.addBillCategory = this.addBillCategory.bind(this)
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

  addBillCategory (options) {
    return new Promise((resolve, reject) => {
      let billDirectory = new BillDirectory()
      billDirectory
        .addCategory(options)
        .then(response => resolve(response))
        .catch(error => reject(error))
    })
  }
}

export async function main (event, context, callback) {
  let addBillCategoryHandler = new AddBillCategoryHandler()

  addBillCategoryHandler
    .getPayload({ event })
    .then(payload => addBillCategoryHandler.addBillCategory(payload))
    .then(response => {
      console.log('add bill category success: ', JSON.stringify(response, null, 2))
      Response.success(callback, JSON.stringify(response), true)
    })
    .catch(error => {
      console.log('add bill category error: ', JSON.stringify(error, null, 2))
      Response.error(callback, JSON.stringify('ADD_BILL_CATEGORY_FAILED'), true)
    })
}
