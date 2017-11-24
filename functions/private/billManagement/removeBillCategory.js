import BillDirectory from '~/libs/bill/Directory'
import Response from '~/libs/utils/Response'

class RemoveBillCategoryHandler {
  constructor () {
    this.getPayload = this.getPayload.bind(this)
    this.removeBillCategory = this.removeBillCategory.bind(this)
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

  removeBillCategory (options) {
    return new Promise((resolve, reject) => {
      let billDirectory = new BillDirectory()
      billDirectory
        .removeCategory(options)
        .then(response => resolve(response))
        .catch(error => reject(error))
    })
  }
}

export async function main (event, context, callback) {
  let removeBillCategoryHandler = new RemoveBillCategoryHandler()

  removeBillCategoryHandler
    .getPayload({ event })
    .then(payload => removeBillCategoryHandler.removeBillCategory(payload))
    .then(response => {
      console.log('remove bill category success: ', JSON.stringify(response, null, 2))
      Response.success(callback, JSON.stringify(response), true)
    })
    .catch(error => {
      console.log('remove bill category error: ', JSON.stringify(error, null, 2))
      Response.error(callback, JSON.stringify('REMOVE_BILL_CATEGORY_FAILED'), true)
    })
}
