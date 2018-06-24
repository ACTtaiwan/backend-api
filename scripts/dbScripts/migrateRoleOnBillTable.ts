import * as dbLib from '../../libs/dbLib'
import * as _ from 'lodash'

var awsConfig = require('../../config/aws.json');

let doBatch = async (bills: dbLib.BillEntity[], tbl: dbLib.BillTable): Promise<boolean | void> => {
  console.log(`Bill batch size = ${bills.length}`)
  let deferred: Array<() => Promise<any>> = []
  for (let i = 0; i < bills.length; ++i) {
    let bill = bills[i]
    if (bill.sponsor) {
      let update = <dbLib.BillEntity> {
        sponsorRoleId: bill.sponsor.id
      }
      deferred.push(() =>
        tbl.updateBill(bill.id, update).then(() =>
        tbl.deleteAttributesFromBill(bill.id, 'sponsor')))
    }
    if (bill.cosponsors && bill.cosponsors.length > 0) {
      let cosponsors = _.clone(bill.cosponsors)
      _.each(cosponsors, co => {
        if (co.role) {
          co.roleId = co.role.id
          delete co.role
        }
      })
      let update = <dbLib.BillEntity> {cosponsors}
      deferred.push(() => tbl.updateBill(bill.id, update))
    }
  }

  console.log(`Updating promises = ${deferred.length}`)
  let batchSize = 10
  while (deferred.length > 0) {
    let batchDeffered = deferred.splice(0, batchSize)
    let batchPromises = _.map(batchDeffered, f => f())
    await Promise.all(batchPromises)
    console.log(`remaining ${deferred.length}`)
  }
  console.log('\n')
}

let migrate = async () => {
  let tblName = (<any> awsConfig).dynamodb.VOLUNTEER_BILLS_TABLE_NAME
  let tbl = dbLib.DynamoDBManager.instance().getTable<dbLib.BillTable>(tblName)
  tbl.forEachBatchOfAllBills(async (bills) => {
    await doBatch(bills, tbl)
  })
}

migrate()
