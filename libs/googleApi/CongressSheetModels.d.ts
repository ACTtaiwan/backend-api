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