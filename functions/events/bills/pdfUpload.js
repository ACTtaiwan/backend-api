import BillDirectory from '~/libs/bill/Directory'
import moment from 'moment'

class BillsHandler {
  constructor () {
    this.getBucketKey = this.getBucketKey.bind(this)
    this.addBillVersion = this.addBillVersion.bind(this)
    this.parseDate = this.parseDate.bind(this)
  }

  getBucketKey ({ event }) {
    let that = this
    return new Promise((resolve, reject) => {
      try {
        let bucketKey = event.Records[0].s3.object.key
        let keys = bucketKey.split('/')
        let billVersion = {
          bucketKey,
          congress: keys[0],
          billTypeCode: keys[1],
          billNumber: keys[2],
          billId: keys[3],
          versionCode: keys[4].split('-')[0],
          versionDate: that.parseDate(keys[4].split('-')[1]),
          contentType: keys[4].split('-')[2]
        }
        console.log('bill version: ', JSON.stringify(billVersion, null, 2))
        resolve(billVersion)
      } catch (error) {
        reject(error)
      }
    })
  }

  addBillVersion (billVersion) {
    return new Promise((resolve, reject) => {
      let billDirectory = new BillDirectory()
      billDirectory
        .addBillVersion(billVersion)
        .then(response => resolve(response))
        .catch(error => reject(error))
    })
  }

  parseDate (date) {
    let isValidDate = moment(date, 'YYYYMMDD').isValid()
    if (isValidDate) {
      let year = date.substring(0, 4)
      let month = date.substring(4, 6)
      let day = date.substring(6, 8)
      return year + '-' + month + '-' + day
    }
    return 'unknown'
  }
}

export async function main (event, context, callback) {
  let billsHandler = new BillsHandler()

  billsHandler
    .getBucketKey({ event })
    .then(billVersion => billsHandler.addBillVersion(billVersion))
    .then(response => {
      console.log('add bill version success: ', JSON.stringify(response, null, 2))
      callback()
    })
    .catch(error => {
      console.log('add bill version error: ', JSON.stringify(error, null, 2))
      callback(error)
    })
}
