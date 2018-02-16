export interface TextVersion {
  versionCode: string  // i.e., eah
  display: string      // i.e., Engrossed Amendment House
  date?: Date
  fullText?: string
  fullTextUrl?: string
  fullTextXmlUrl?: string
  fullTextPdfUrl?: string
}

export interface Tracker {
  stepName: string
  selected: boolean
}

export interface CongressGovSponsor {
  bioGuideId: string
  name: string
  congressGovUrl: string
}

export interface CongressGovTitle {
  type?: string,
  text?: string,
  titlesAsPortions?: string[]
}

export interface CongressGovTitleInfo {
  enactedTitle: CongressGovTitle
  shortTitles: { [key in ChamberType]: CongressGovTitle[] }
  officialTitle: CongressGovTitle
}

export interface CongressGovAction {
  datetime: number // UTC
  description: string
  chamber?: ChamberType
}

export interface CongressGovCoSponsor {
  cosponsor: CongressGovSponsor
  dateCosponsored?: number // UTC
}

export interface CongressGovCommitteeRecord {
  date: number // UTC
  activity: string
}

export interface CongressGovCommitteeActivity {
  fullname: string
  chamber?: ChamberType
  records: CongressGovCommitteeRecord[]
  subcommittees?: CongressGovCommitteeActivity[]
}

export interface CongressGovBill {
  congress: number
  typeCode: BillTypeCode
  billNumber: number
  congressGovUrl?: string
}

export interface CongressGovSummaryParagraph {
  highlighted: boolean
  text: string
}

export interface CongressGovSummary {
  title: string
  paragraphs: CongressGovSummaryParagraph[]
}

export interface CongressGovAllInfo {
  titles: CongressGovTitleInfo
  actionsOverview: CongressGovAction[]
  actionsAll: CongressGovAction[]
  cosponsors: CongressGovCoSponsor[]
  committees: CongressGovCommitteeActivity[]
  relatedBills: CongressGovBill[]
  subjects: string[]
  summaryLatest: CongressGovSummary
  summaryAll: CongressGovSummary[]
}

export type BillTypeCode = 'hr' | 's' | 'sconres' | 'hres' | 'sres' | 'sjres' | 'hconres' | 'hjres'

export type BillTrackerStatus = 'intro' | 'house' | 'senate' | 'president' | 'law'

export type ChamberType = 'senate' | 'house'
