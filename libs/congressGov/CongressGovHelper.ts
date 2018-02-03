
import * as _ from 'lodash'
import { BillTypeCode, CongressGovBill } from './CongressGovModels'

export class CongressGovHelper {
  public static readonly CONGRESS_GOV_HOST = 'https://www.congress.gov'
  public static readonly MIN_CONGRESS_DATA_AVAILABLE = 93

  public static billPathToTextUrl (billPath: string): string {
    if (!billPath) {
      return null
    }

    billPath = billPath.startsWith('/') ? billPath : '/' + billPath
    billPath = billPath.endsWith('/') ? billPath : billPath + '/'
    const url = CongressGovHelper.CONGRESS_GOV_HOST + billPath + 'text'
    return url
  }

  public static billPathToAllInfoUrl (billPath: string): string {
    if (!billPath) {
      return null
    }

    billPath = billPath.startsWith('/') ? billPath : '/' + billPath
    billPath = billPath.endsWith('/') ? billPath : billPath + '/'
    const url = CongressGovHelper.CONGRESS_GOV_HOST + billPath + 'all-info?allSummaries=show'
    return url
  }

  public static generateCongressGovBillPath (congress: number, typeCode: string, billNumber: number): string {
    const type = CongressGovHelper.typeCodeToFullTypeNameMap[typeCode]
    const path = `/bill/${congress}th-congress/${type}/${billNumber}`
    return path
  }

  public static generateCongressGovUrl (congress: number, typeCode: string, billNumber: number): string {
    const path = CongressGovHelper.generateCongressGovBillPath(congress, typeCode, billNumber)
    const url = CongressGovHelper.CONGRESS_GOV_HOST + path + '/text'
    return url
  }

  public static pathToFullUrl (path: string): string {
    const host = CongressGovHelper.CONGRESS_GOV_HOST
    return (path && path.startsWith(host)) ? path : host + path
  }

  public static parseBillUrl (billUrl: string): CongressGovBill {
    if (billUrl) {
      const host = CongressGovHelper.CONGRESS_GOV_HOST
      const urlComp = billUrl.replace(`${host}/bill/`, '').split('/')
      if (urlComp.length >= 3) {
        const congress = parseInt(urlComp[0])
        const typeCode = CongressGovHelper.fullTypeNameToTypeCodeMap[urlComp[1]]
        const billNumber = parseInt(urlComp[2])
        const path = CongressGovHelper.generateCongressGovBillPath(congress, typeCode, billNumber)
        const congressGovUrl = CongressGovHelper.pathToFullUrl(path)
        return { congress, typeCode, billNumber, congressGovUrl }
      }
    }
    return null
  }

  public static get typeCodeToFullTypeNameMap (): {[key in BillTypeCode]: string} {
    return {
      s: 'senate-bill',
      hr: 'house-bill',
      sres: 'senate-resolution',
      hres: 'house-resolution',
      sjres: 'senate-joint-resolution',
      hjres: 'house-joint-resolution',
      sconres: 'senate-concurrent-resolution',
      hconres: 'house-concurrent-resolution'
    }
  }

  public static get fullTypeNameToTypeCodeMap (): {[key: string]: BillTypeCode} {
    return <{[key: string]: BillTypeCode}> _.invert(CongressGovHelper.typeCodeToFullTypeNameMap)
  }
}