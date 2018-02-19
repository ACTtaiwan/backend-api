import * as dbLib from '../../libs/dbLib'
import * as awsConfig from '../../config/aws.json'

let f = async () => {
  const db = dbLib.DynamoDBManager.instance()
  const tblName = (<any> awsConfig).dynamodb.VOLUNTEER_BILLS_TABLE_NAME
  const tbl = <dbLib.BillTable> db.getTable(tblName)
  const bills = await tbl.getAllBills('id', 'congress', 'billNumber', 'billType', 'tags')
  for (let i = 0; i < bills.length; ++i) {
    const bill = bills[i]
    const display = dbLib.DbHelper.displayBill(bill)
    console.log(`${i} / ${bills.length}: ${display}`)
    console.log(`tags = ${JSON.stringify(bill.tags, null, 2)}`)
    if (bill.tags) {
      await tbl.deleteAttributesFromBill(bill.id, 'tags')
    }
  }
}

f()
