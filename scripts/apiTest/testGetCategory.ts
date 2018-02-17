import * as dbLib from '../../libs/dbLib/DynamoDBManager'
import * as _ from 'lodash'
import * as api from '../../functions/private/billManagement/billCategoryHandler'

let test = async () => {
  let apiObj = new api.BillCategoryApi()
  let out = await apiObj.fullFetchWithCongress(['9a6cb046-2f66-4d4b-8148-10b57793341b'], [115, 114])
  console.log(`out = ${JSON.stringify(out, null, 2)}`)
}

test()