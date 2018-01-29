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

export type BillTypeCode = 'hr' | 's' | 'sconres' | 'hres' | 'sres' | 'sjres' | 'hconres' | 'hjres'

export type BillTrackerStatus = 'intro' | 'house' | 'senate' | 'president' | 'law'

export type ChamberType = 'senate' | 'house'
