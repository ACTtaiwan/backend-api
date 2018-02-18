import * as dbLib from '../../libs/dbLib/DynamoDBManager'
import * as _ from 'lodash'
import * as api from '../../functions/private/billManagement/billCategoryHandler'

let test = async () => {
  let apiObj = new api.BillCategoryApi()
  let out = await apiObj.fullFetchWithCongress(['51bd7b94-a7f7-4417-bff6-f41ac6b00c08'], [112, 113, 114, 115])
  console.log(`out = ${JSON.stringify(out, null, 2)}`)
}

test()