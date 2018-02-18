import { GoogleSheetAgent, MiguelCategorySheetAgent } from '../../libs/googleApi/GoogleSheetAgent'
import { BillRow, CategoryRow, MiguelCategoryRow, CategoryCode } from '../../libs/googleApi/CongressSheetModels';
import * as _ from 'lodash'
import { GoogleBillSheetSync } from './syncGoogleBillSheet';

let getMappingCategory = (cat: (keyof MiguelCategoryRow)): CategoryCode => {
  switch (cat) {
    case 'appropriation':
      return 'appn'

    case 'arms':
    case 'sales':
    case 'transfer':
      return 'arm'

    case 'democracy':
      return 'dem'

    case 'internationalSpace':
    case 'internationalOrganization':
    case 'us':
      return 'int'

    case 'other':
      return 'other'

    case 'taiwanDefense':
      return 'def'

    case 'usTaiwanRelation':
    case 'office':
    case 'tra':
    case 'trade':
      return 'ustw'
  }
  return null
}

interface MappingResult {
  congress: number
  billTypeDisplay: string
  billNumber: number
  categories: CategoryCode[]
}

let getMiguelMappingResults = async (): Promise<{[queryKey: string]: MappingResult}> => {
  let miguelSheet = new MiguelCategorySheetAgent()
  let miguelRows = await miguelSheet.getSheet()
  let mappingResults: MappingResult[] = []
  _.each(miguelRows, row => {
    let res = <MappingResult> {
      congress: row.congress,
      billTypeDisplay: row.billTypeDisplay,
      billNumber: row.billNumber,
      categories: []
    }

    let cats: CategoryCode[] = []
    _.each(row, (val, key: (keyof MiguelCategoryRow)) => {
      if (typeof val === 'boolean' && val) {
        cats.push(getMappingCategory(key))
      }
    })
    cats = _.uniq(cats)
    res.categories = cats
    mappingResults.push(res)
  })
  return _.keyBy(mappingResults, x => queryKey(x))
}

let queryKey = (item: MiguelCategoryRow | BillRow) => {
  return `${item.congress}-${item.billTypeDisplay.toLowerCase()}-${item.billNumber}`
}

let f = async () => {
  let mappingResults = await getMiguelMappingResults()
  let billSheet = new GoogleSheetAgent()
  let sheetSync = new GoogleBillSheetSync()
  let billRows = await billSheet.getBillSheet()
  let catRows = await billSheet.getCategorySheet()
  let codeCatRowMap = _.keyBy(catRows, 'code')
  for (let rowId = 0; rowId < billRows.length; ++rowId) {
    let row = billRows[rowId]
    let miguelRes = mappingResults[queryKey(row)]
    if (!miguelRes) {
      console.log(`can not found bill in Miguel's sheet = ${queryKey(row)}`)
    } else {
      let rowCats = await sheetSync.findCategories(row.categories)
      let rowCatCodes = _.map(rowCats, x => x.code)
      let miguelCatCodes = miguelRes.categories
      let interCatCodes = _.intersection(rowCatCodes, miguelCatCodes)
      let addCatCodes = _.difference(miguelCatCodes, interCatCodes)
      if (!_.isEmpty(addCatCodes)) {
        let finalUnion = _.map([...rowCatCodes, ...addCatCodes], x => codeCatRowMap[x].displayName)
        console.log(`${queryKey(row)} (rowId = ${rowId})`)
        console.log(`excel = ${JSON.stringify(rowCatCodes)}`)
        console.log(`miguel = ${JSON.stringify(miguelCatCodes)}`)
        console.log(`add = ${JSON.stringify(addCatCodes)}`)
        console.log(`union = ${finalUnion.join(', ')}\n`)
        row.categories = finalUnion
      }
    }
  }

  // batch write to Google sheet
  await billSheet.rewriteBillSheetCategoryColumn(billRows)
}

f()