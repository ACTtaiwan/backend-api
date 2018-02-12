export * from './DynamoDBManager'
export * from './CongressGovSyncBillTable'
export * from './PersonTable'
export * from './RoleTable'
export * from './BillTable'
export * from './BillTypeTable'
export * from './BillCategoryTable'
export * from './TagTable'

import { BillEntity } from './BillTable'

export class DbHelper {
  public static displayBill (bill: BillEntity) {
    return `${bill.congress}-${bill.billType.code}-${bill.billNumber} (${bill.id})`
  }
}
