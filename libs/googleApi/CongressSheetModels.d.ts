export interface BillRow {
  congress?: number,
  billTypeDisplay?: string,
  billNumber?: number,
  title?: string,
  title_zh?: string,
  versionCode?: string,
  categories?: string[],
  tags?: string[],
  relevence?: number,
  china?: string,
  insight?: string,
  comment?: string
}

export interface TagRow {
  tag?: string
  type?: string
  contributor?: string
  comment?: string
}

export type CategoryCode = 'appn' | 'arm' | 'dem' | 'int' | 'other' | 'tra' | 'def' | 'trade' | 'ustw'

export interface CategoryRow {
  displayName?: string
  code?: CategoryCode
  contributor?: string
  comment?: string
}

export interface VersionRow {
  version?: string
  abbr?: string
  description?: string
  chambers?: string
}

export interface MiguelCategoryRow {
  congress: number
  billTypeDisplay?: string
  billNumber?: number
  title: string
  appropriation: boolean
  arms: boolean
  sales: boolean
  transfer: boolean
  democracy: boolean
  internationalSpace: boolean
  internationalOrganization: boolean
  us: boolean
  other: boolean
  taiwanDefense: boolean
  usTaiwanRelation: boolean
  office: boolean
  tra: boolean
  trade: boolean
}