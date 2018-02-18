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
}

export interface VersionRow {
  version?: string
  abbr?: string
  description?: string
  chambers?: string
}
