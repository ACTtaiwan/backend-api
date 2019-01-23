
import * as _ from 'lodash'
import { BillTypeCode, CongressGovBill } from './CongressGovModels'

export class CongressGovHelper {
  public static readonly CONGRESS_GOV_HOST = 'https://www.congress.gov'
  public static readonly MIN_CONGRESS_DATA_AVAILABLE = 93
  public static readonly CURRENT_CONGRESS = 116

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

  public static generateCongressGovBillPath (congress: number, typeCode: BillTypeCode, billNumber: number): string {
    const type = CongressGovHelper.typeCodeToFullTypeNameMap[typeCode]
    const path = `/bill/${congress}th-congress/${type}/${billNumber}`
    return path
  }

  public static generateCongressGovUrl (congress: number, typeCode: BillTypeCode, billNumber: number): string {
    const path = CongressGovHelper.generateCongressGovBillPath(congress, typeCode, billNumber)
    const url = CongressGovHelper.CONGRESS_GOV_HOST + path + '/text'
    return url
  }

  public static generateCongressGovMemberUrl (bioGuideId: string): string {
    const url = CongressGovHelper.CONGRESS_GOV_HOST + '/member/m/' + bioGuideId
    return url
  }

  public static pathToFullUrl (path: string): string {
    const host = CongressGovHelper.CONGRESS_GOV_HOST
    return (path && path.startsWith(host)) ? path : host + path
  }

  public static parseBillUrlOrPath (billUrl: string): CongressGovBill {
    if (billUrl) {
      const host = CongressGovHelper.CONGRESS_GOV_HOST
      const replaceStr = billUrl.startsWith(host) ? `${host}/bill/` : '/bill/'
      const urlComp = billUrl.replace(replaceStr, '').split('/')
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