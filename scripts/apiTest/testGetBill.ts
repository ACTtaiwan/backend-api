import * as dbLib from '../../libs/dbLib/DynamoDBManager'
import * as _ from 'lodash'
import * as api from '../../functions/private/billManagement/billHandler'

let test = async (req: api.QueryBillsRequest = {}) => {
  let billApi = new api.BillApi()
  let out = await billApi.queryBills(req)
  console.log(`out = ${JSON.stringify(out, null, 2)}`)
}

// test({
//   flushOut: true,
//   congress: 115,
//   attrNamesToGet: ['id', 'billType', 'billNumber', 'congress']
// })

test({congress: [114, 115]})
// test()

let test2 = async () => {
  let billApi = new api.BillApi()
  let out = await billApi.getBillById({
    id: ['573ce7bd-3765-4df8-be4b-3307c9ef9958']
  })
  console.log(JSON.stringify(out, null, 2))
}

// test2()
