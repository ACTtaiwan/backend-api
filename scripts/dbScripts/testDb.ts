import * as dbLib from '../../libs/dbLib/DbLib'
import * as awsConfig from '../../config/aws.json'
import * as aws from 'aws-sdk'
import { CongressGovDataProvider } from '../../libs/congressGov/CongressGovDataProvider'
import { CongressGovTextParser } from '../../libs/congressGov/CongressGovTextParser'
import { CongressGovTrackerParser } from '../../libs/congressGov/CongressGovTrackerParser'
import { CongressGovHelper } from '../../libs/congressGov/CongressGovHelper'
import * as models from '../../libs/congressGov/CongressGovModels'
import * as _ from 'lodash'

// const db = dbLib.DynamoDBManager.instance()
// const tableName = (<any> awsConfig).dynamodb.CONGRESSGOV_SYNC_ALL_INFO_TABLE_NAME

// let tbl = db.getTable(tableName)
// const obj: dbLib.CongressGovSyncAllInfoEntity = {
//   rawData: `some text`,
//   urlPath: 'aur/b'
// }

// db.createTableIfNotExist(tableName);

// tbl.putObject(obj)
// .then(data => {
//   console.log(JSON.stringify(data, null, 2))
// })
// .catch(err => {
//   console.log(err)
// })

// let c = new CongressGovDataProvider()
// c.fetchBillContent('/bill/115th-congress/house-bill/4288').then($ => {
//   $.html()
// })

const tblSyncName = (<any> awsConfig).dynamodb.CONGRESSGOV_SYNC_BILL_TABLE_NAME
const tblSync = <dbLib.CongressGovSyncBillTable> dbLib.DynamoDBManager.instance().getTable(tblSyncName)
// const url = 'https://www.congress.gov/bill/115th-congress/house-bill/4288/text'
// tbl.getObjectByUrlPath(url).then(obj => {
//   console.log(JSON.stringify(obj, null, 2))
// })
// tblSync.getAllObjects('urlPath').then(objs => console.log('total size =' + objs.length))

// let p = new CongressGovTrackerParser()
// p.getTracker('bill/115th-congress/house-bill/4288').then(result => console.log(JSON.stringify(result, null, 2)))

// let p = new CongressGovTextParser()
// p.getAllTextVersions('bill/115th-congress/house-bill/4288').then(result => console.log(JSON.stringify(result, null, 2)))
// p.getAllTextVersions('bill/114th-congress/senate-bill/1635').then(result => console.log(JSON.stringify(result, null, 2)))

// const tblName = (<any> awsConfig).dynamodb.VOLUNTEER_BILLS_TABLE_NAME
// const tbl = <dbLib.BillTable> dbLib.DynamoDBManager.instance().getTable(tblName)
// tbl.getAllBills().then(objs => console.log('total size =' + objs.length))
// const id = '9bff167a-847c-4dd2-9732-315dd0828529'
// tbl.getObjectById(id).then(obj => {
//   console.log(JSON.stringify(obj, null, 2))
// })

// tbl.updateTracker(id, [{stepName: 'step1', selected: true}]).then(obj => {
//   console.log(JSON.stringify(obj, null, 2))
// })

// tbl.deleteAttributesFromObject(id, 'trackers').then(obj => {
//   console.log(JSON.stringify(obj, null, 2))
// })

// tbl.getAllBills().then(obj => {
//   let url = _.map(obj, o => CongressGovHelper.generateCongressGovUrl(o.congress, o.billType.code, o.billNumber))
//   console.log(JSON.stringify(url, null, 2))
// })

const tblName = (<any> awsConfig).dynamodb.VOLUNTEER_ROLES_TABLE_NAME
const tbl = <dbLib.RoleTable> dbLib.DynamoDBManager.instance().getTable(tblName)

let f = async () => {
  let roles = await tbl.getRolesByCongress(115)
  console.log(JSON.stringify(roles, null, 2))
}

f()