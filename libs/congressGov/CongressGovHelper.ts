
export class CongressGovHelper {
  public static readonly CONGRESS_GOV_HOST = 'https://www.congress.gov'
  public static readonly MIN_CONGRESS_DATA_AVAILABLE = 93

  public static generateCongressGovBillPath (congress: number, typeCode: string, billNumber: number): string {
    const type = CongressGovHelper.typeCodeCongressGovPathMap[typeCode]
    const path = `/bill/${congress}th-congress/${type}/${billNumber}`
    return path
  }

  public static generateCongressGovUrl (congress: number, typeCode: string, billNumber: number): string {
    const path = CongressGovHelper.generateCongressGovBillPath(congress, typeCode, billNumber)
    const url = CongressGovHelper.CONGRESS_GOV_HOST + path + '/text'
    return url
  }

  public static get typeCodeCongressGovPathMap () {
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
}