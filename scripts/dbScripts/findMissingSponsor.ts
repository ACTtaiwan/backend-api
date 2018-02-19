import * as dbLib from '../../libs/dbLib'
import * as awsConfig from '../../config/aws.json'
import * as _ from 'lodash'
import { CongressGovHelper } from '../../libs/congressGov/CongressGovHelper';

let f = async() => {
  const db = dbLib.DynamoDBManager.instance()
  const tblName = (<any> awsConfig).dynamodb.VOLUNTEER_BILLS_TABLE_NAME
  const tbl = <dbLib.BillTable> db.getTable(tblName)
  let bills = await tbl.getAllBills('id', 'congress', 'billNumber', 'billType', 'sponsor', 'cosponsors')
  bills = _.filter(bills, b => b.congress >= CongressGovHelper.MIN_CONGRESS_DATA_AVAILABLE)

  console.log('-- bills No Sponsor --')
  let billsNoSponsor = _.filter(bills, b => !!!b.sponsor)
  for (let i = 0; i < billsNoSponsor.length; ++i) {
    const bill = billsNoSponsor[i]
    const display = dbLib.DbHelper.displayBill(bill)
    console.log(`${display}`)
  }

  let billSponsorNoPerson = _.filter(bills, b => b.sponsor && !!!b.sponsor.person)
  console.log('\n\n')
  console.log('-- bills having Sponsor but no person--')
  for (let i = 0; i < billSponsorNoPerson.length; ++i) {
    const bill = billSponsorNoPerson[i]
    const display = dbLib.DbHelper.displayBill(bill)
    console.log(`${display}`)
  }

  let billCoSponsor = _.filter(bills, b => b.cosponsors && b.cosponsors.length > 0)
  console.log('\n\n')
  console.log('-- bills having Co-Sponsor but no person--')
  for (let i = 0; i < billCoSponsor.length; ++i) {
    const bill = billCoSponsor[i]
    let msg = ''
    _.each(bill.cosponsors, co => {
      if (!co.role && co.dateCosponsored) {
        msg += 'missing role, dateCoSponsored = ' + co.dateCosponsored + '\n'
      }
      if (co.role && !co.role.person) {
        msg += `missing person for role = ${co.role}`
      }
    })
    if (msg) {
      const display = dbLib.DbHelper.displayBill(bill)
      console.log(`${display}: \n${msg}`)  
    }
  }
}

f()
