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

// test({congress: [115], categoryIdx: ['9a6cb046-2f66-4d4b-8148-10b57793341b']})
// test()

let test2 = async () => {
  let billApi = new api.BillApi()
  let out = await billApi.getBillById({
    // id: ['cbb2f2e2-db6a-433f-b5a2-50ad5b3a81e2', '573ce7bd-3765-4df8-be4b-3307c9ef9958']
    id: ['cbb2f2e2-db6a-433f-b5a2-50ad5b3a81e2']
  })
  console.log(JSON.stringify(out, null, 2))
}

test2()
