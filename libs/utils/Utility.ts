import * as moment from 'moment'
import * as request from 'request'
import * as cheerio from 'cheerio'
import * as _ from 'lodash'

export default class Utility {
  private static requestQueue = []
  private static timer: NodeJS.Timer

  // parsing date strings in formats of:
  //   - 12/05/2016-7:10pm
  //   - 12/06/2016
  //   - (12/06/2016)
  public static parseDateTimeStringAtEST (dateStr: string, dateFormat: string = 'MM/DD/YYYY'): Date {
    dateStr = dateStr.trim();
    dateStr = dateStr.replace(/\(|\)/g, '');
    let dateTimeStr = dateStr.split('-');
    let hasTime = (dateTimeStr.length > 1) && dateTimeStr[1].includes(':');
    if (hasTime) {
      dateStr = `${dateTimeStr[0]} ${dateTimeStr[1]} -0500`; // DC timezone offset (EST)
    } else {
      dateStr = `${dateStr} 00:00m -0500`; // DC timezone offset (EST)
    }
    const format = `${dateFormat} h:mma Z`;
    const date = Utility.parseDateTimeStringOfFormat(dateStr, format);
    return date;
  }

  public static parseDateTimeStringOfFormat (dateStr: string, format: string = 'YYYY-MM-DD'): Date {
    let d = moment(dateStr, format)
    return d.isValid() ? d.toDate() : null
  }

  public static fetchUrlContent (url: string, isBinary: boolean = false): Promise<any> {
    let params = {
      method: 'GET',
      url: url
    }

    if (isBinary) {
      params['encoding'] = null
    }
    return Utility.pushToUrlRequestQueue(params)
  }

  public static parseHtmlContent (url: string): Promise<any> {
    return Utility.fetchUrlContent(url).then(body => cheerio.load(body))
  }

  public static datetimeStringInDCTimezone (date: Date, format: string = 'YYYY-MM-DD'): string {
    return moment(date, format).utcOffset(-5 * 60).format(format)
  }

  private static pushToUrlRequestQueue (params: any): Promise<any> {
    console.log(`[Utility::pushToUrlRequestQueue()] push params = ${JSON.stringify(params, null, 2)}`)
    let p = new Promise((resolve, reject) => {
      Utility.requestQueue.push({params, resolve, reject})
    })
    if (!Utility.timer) {
      console.log(`[Utility::pushToUrlRequestQueue()] init timer`)
      let isBusy = false
      Utility.timer = setInterval(async () => {
        if (!isBusy) {
          isBusy = true
          if (!_.isEmpty(Utility.requestQueue)) {
            let task = Utility.requestQueue.shift()
            let randomDelay = Math.floor(200 + Math.random() * 800) // random delay to prevent DDoS blocking
            console.log(`[Utility::pushToUrlRequestQueue()] timer not busy.
                         After randomDelay = ${randomDelay} will process task = ${JSON.stringify(task.params, null, 2)}`)
            await Utility.sleep(randomDelay)
            console.log(`[Utility::pushToUrlRequestQueue()] processing task.`)
            request(task.params, (error, response, body) => {
              console.log(`[Utility::pushToUrlRequestQueue()] request done. set isBusy = false`)
              isBusy = false
              if (!error && response.statusCode === 200) {
                task.resolve(body)
              } else {
                task.reject(`can not connect url = ${task.params.url}.
                              Error = ${error}
                              ResponseCode = ${response && response.statusCode} Body = ${body}`)
              }
            })
          } else {
            console.log(`[Utility::pushToUrlRequestQueue()] queue is empty. Clear timeout.`)
            clearTimeout(Utility.timer)
            Utility.timer = null
            isBusy = false
          }
        }
      }, 500);
    }
    return p
  }

  public static async sleep (ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  public static stringToArray<T> (str: string, postConvert: (x: string) => T = _.identity): T[] {
    let arr = _.filter(str.trim().split(','), x => !!x)
    let rtn = _.map(arr, (x: string) => postConvert(x.trim()))
    return rtn
  }

  public static isLocalRun (): boolean {
    return process.env.IS_LOCAL !== undefined ||
      process.env.DB_CONFIG === undefined;
  }
}
