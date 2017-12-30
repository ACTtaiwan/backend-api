import * as _ from 'lodash'
import * as aws from 'aws-sdk'
import * as google from 'googleapis'
import GoogleAuth = require('google-auth-library')

class GoogleApiAuth {
  private static readonly SCOPES = ['https://www.googleapis.com/auth/spreadsheets.readonly']
  private static jwtAuth: any

  public static get auth (): Promise<any> {
    if (!GoogleApiAuth.jwtAuth || (GoogleApiAuth.jwtAuth && GoogleApiAuth.isAboutExpired())) {
      console.log(`[GoogleApiAuth::auth()] new a jwt auth`)
      return GoogleApiAuth.getKeyFileFromS3().then(key => GoogleApiAuth.updateJwtAuth(key))
    } else {
      console.log(`[GoogleApiAuth::auth()] return existing jwt auth`)
      return Promise.resolve(GoogleApiAuth.jwtAuth)
    }
  }

  private static isAboutExpired (): boolean {
    if (!GoogleApiAuth.jwtAuth) {
      return true
    } else {
      let expiryDate = GoogleApiAuth.jwtAuth.expiry_date
      let currData = new Date().getTime()
      let driftInMs = 10 * 1000 // 10 mins
      let aboutExpired = currData + driftInMs >= expiryDate
      console.log(`[GoogleApiAuth::isAboutExpired()] aboutExpired = ${aboutExpired}`)
      return aboutExpired
    }
  }

  private static getKeyFileFromS3 (): Promise<any> {
    return new Promise((resolve, reject) => {
      let s3 = new aws.S3();
      var params = {
        Bucket: 'taiwanwatch-credentials',
        Key: 'google-api/googl-sheet-api-keyfile.json'
       }
      console.log(`[GoogleApiAuth::getKeyFileFromS3()] requesting S3`)
      s3.getObject(params, (err, data) => {
        if (err) {
          console.log(`[GoogleApiAuth::getKeyFileFromS3()] Error = ${JSON.stringify(err, null, 2)}`)
          reject(err)
        } else {
          console.log(`[GoogleApiAuth::getKeyFileFromS3()] OK. data = ${JSON.stringify(data, null, 2)}`)
          try {
            let json = JSON.parse(data.Body.toString())
            console.log(`[GoogleApiAuth::getKeyFileFromS3()] JSON parse done`)
            resolve(json)
          } catch (e) {
            console.log(`[GoogleApiAuth::getKeyFileFromS3()] JSON parse failed. Error = ${e}`)
            reject(e)
          }
        }
      })
    })
  }

  private static updateJwtAuth (key: any): Promise<any> {
    return new Promise((resolve, reject) => {
      console.log(`[GoogleApiAuth::updateJwtAuth()] start with key = ${JSON.stringify(key, null, 2)}`)
      var jwtClient = new google.auth.JWT(
        key.client_email,
        null,
        key.private_key,
        GoogleApiAuth.SCOPES,
        null
      )

      console.log(`[GoogleApiAuth::updateJwtAuth()] jwtClient.authorize()`)
      jwtClient.authorize((err, tokens) => {
        if (err) {
          console.log(`[GoogleApiAuth::updateJwtAuth()] Failed. Error = ${JSON.stringify(err, null, 2)}`)
          return reject(err)
        } else {
          console.log(`[GoogleApiAuth::updateJwtAuth()] OK. jwtClient = ${JSON.stringify(jwtClient, null, 2)}`)
          GoogleApiAuth.jwtAuth = jwtClient
          resolve(GoogleApiAuth.jwtAuth)
        }
      })
    })
  }
}

export default class GoogleSheetAgent {
  private readonly sheets = google.sheets('v4')
  private readonly spreadsheetId: string = '147cXhAFUyrNENCk6CAW7El1SbpfAXYfQICNyVKbBrSQ'

  public queryRange (q: string): Promise<any> {
    return GoogleApiAuth.auth.then(auth => new Promise((resolve, reject) => {
      this.sheets.spreadsheets.values.get({
        auth: auth,
        spreadsheetId: this.spreadsheetId,
        range: q
      }, (err, response) => {
        if (err) {
          reject(err)
        } else {
          resolve(response)
        }
      })
    }))
  }
}
