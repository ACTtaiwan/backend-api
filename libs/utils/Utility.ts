import * as moment from 'moment'
import * as request from 'request'
import * as cheerio from 'cheerio'

export default class Utility {
  // parsing date strings in formats of:
  //   - 12/05/2016-7:10pm
  //   - 12/06/2016
  //   - (12/06/2016)
  public static parseDateTimeString (dateStr: string): Date {
    dateStr = dateStr.replace(/\(|\)/g, '')
    let dateTimeStr = dateStr.split('-')
    let timeStr = (dateTimeStr.length > 1) ? dateTimeStr[1] : '0:00am'
    dateStr = dateTimeStr[0] + ' ' + timeStr + ' -0500'
    let d = moment(dateStr, 'MM/DD/yyyy h:mma Z')
    console.log(d)
    return d.isValid() ? d.toDate() : null
  }

  public static fetchUrlContent (url: string, isBinary: boolean = false): Promise<any> {
    return new Promise((resolve, reject) => {
      let params = {
        method: 'GET',
        url: url
      }

      if (isBinary) {
        params['encoding'] = null
      }

      request(params, (error, response, body) => {
        if (!error && response.statusCode === 200) {
          resolve(body)
        } else {
          reject(`can not connect url = ${url}. Error = ${error} ResponseCode = ${response.statusCode} Body = ${body}`)
        }
      })
    })
  }

  public static parseHtmlContent (url: string): Promise<any> {
    return Utility.fetchUrlContent(url).then(body => cheerio.load(body))
  }

  public static datetimeStringInDCTimezone (date: Date, format: string = 'YYYY-MM-DD'): string {
    return moment(date, format).utcOffset(-5 * 60).format(format)
  }
}
