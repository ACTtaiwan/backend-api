import BillCategory from '~/libs/bill/BillCategory'
import Response from '~/libs/utils/Response'

class BillCategoryHandler {
  constructor () {
    this.getPayload = this.getPayload.bind(this)
    this.getBillCategories = this.getBillCategories.bind(this)
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

  getBillCategories (options) {
    return new Promise((resolve, reject) => {
      let billCategory = new BillCategory()
      billCategory
        .getList(options)
        .then(response => resolve(response))
        .catch(error => reject(error))
    })
  }
}

export async function main (event, context, callback) {
  let billCategoryHandler = new BillCategoryHandler()

  billCategoryHandler
    .getPayload({ event })
    .then(payload => billCategoryHandler.getBillCategories(payload))
    .then(response => {
      console.log('get bill categories success: ', JSON.stringify(response, null, 2))
      Response.success(callback, JSON.stringify(response), true)
    })
    .catch(error => {
      console.log('get bill categories error: ', JSON.stringify(error, null, 2))
      Response.error(callback, JSON.stringify('GET_BILL_CATEGORIES_FAILED'), true)
    })
}
