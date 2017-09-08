import Logon from '~/libs/auth/Logon'
import Response from '~/libs/utils/Response'

class LogonHandler {
  constructor() {
    this.getPayload = this.getPayload.bind(this)
    this.logon = this.logon.bind(this)
  }

  getPayload(options) {
    return new Promise((resolve, reject) => {
      try {
        let payload = JSON.parse(options.event.body)
        resolve(payload)
      } catch (error) {
        reject(error)
      }
    })
  }

  logon(options) {
    return new Promise((resolve, reject) => {
      let logon = new Logon()
      logon
        .logon(options)
        .then(response => resolve(response))
        .catch(error => reject(error))
    })
  }
}

export async function main(event, context, callback) {
  let logonHandler = new LogonHandler()

  logonHandler
    .getPayload({ event })
    .then(payload => logonHandler.logon(payload))
    .then(response => {
      console.log('logon success: ', JSON.stringify(response, null, 2))
      Response.success(callback, JSON.stringify(response), true)
    })
    .catch(error => {
      console.log('logon error: ', JSON.stringify(error, null, 2))
      Response.error(callback, JSON.stringify('LOGON_FAILED'), true)
    })
}
