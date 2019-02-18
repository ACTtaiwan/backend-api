import { BillEntity } from './BillTable';

export class DbHelper {
  public static displayBill (bill: BillEntity) {
    return `${bill.congress}-${bill.billType.code}-${bill.billNumber} (${bill.id})`;
  }
}
