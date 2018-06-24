// import * as dbLib from '../../libs/dbLib'
// import * as awsConfig from '../../config/aws.json'
// import * as _ from 'lodash'
// import * as api from 'tw-apiserver/src'

// let migrateBill = async () => {
//   let mongodb = await api.DBHelper.instance
//   let tblName = (<any> awsConfig).dynamodb.VOLUNTEER_BILLS_TABLE_NAME
//   let tbl = dbLib.DynamoDBManager.instance().getTable<dbLib.BillTable>(tblName)
//   await tbl.forEachBatchOfAllBills(async (objs) => {
//     objs = _.map(objs, x => {
//       if (x.tags) {
//         let tags = _.keys(x.tags)
//         x.tags = <any> tags
//       }
//       x['_id'] = x.id
//       delete x.id
//       return x
//     })
//     await mongodb.insertObjects(tbl.tableName, objs)
//   })
//   console.log('DONE!')
// }

// let migrateBillType = async () => {
//   let mongodb = await api.DBHelper.instance
//   let tblName = (<any> awsConfig).dynamodb.VOLUNTEER_BILLTYPES_TABLE_NAME
//   let tbl = dbLib.DynamoDBManager.instance().getTable<dbLib.BillTypeTable>(tblName)
//   let objs = await tbl.getAllTypes()
//   objs = _.map(objs, x => {
//     x['_id'] = x.id
//     delete x.id
//     return x
//   })
//   await mongodb.insertObjects(tbl.tableName, objs)
//   console.log('DONE!')
// }

// let migrateBillVersion = async () => {
//   let mongodb = await api.DBHelper.instance
//   let tblName = (<any> awsConfig).dynamodb.VOLUNTEER_BILLVERSIONS_TABLE_NAME
//   let tbl = dbLib.DynamoDBManager.instance().getTable<dbLib.BillVersionTable>(tblName)
//   let objs = await tbl.getAllVersions()
//   objs = _.map(objs, x => {
//     x['_id'] = x.id
//     delete x.id
//     return x
//   })
//   await mongodb.insertObjects(tbl.tableName, objs)
//   console.log('DONE!')
// }

// let migrateBillCategory = async () => {
//   let mongodb = await api.DBHelper.instance
//   let tblName = (<any> awsConfig).dynamodb.VOLUNTEER_BILLCATEGORIES_TABLE_NAME
//   let tbl = dbLib.DynamoDBManager.instance().getTable<dbLib.BillCategoryTable>(tblName)
//   let objs = await tbl.getAllCategories()
//   objs = _.map(objs, x => {
//     x['_id'] = x.id
//     delete x.id
//     return x
//   })
//   await mongodb.insertObjects(tbl.tableName, objs)
//   console.log('DONE!')
// }

// let migrateTag = async () => {
//   let mongodb = await api.DBHelper.instance
//   let tblName = (<any> awsConfig).dynamodb.VOLUNTEER_TAGS_TABLE_NAME
//   let tbl = dbLib.DynamoDBManager.instance().getTable<dbLib.TagTable>(tblName)
//   let objs = await tbl.getAllTags()
//   await mongodb.insertObjects(tbl.tableName, objs)
//   console.log('DONE!')
// }

// let migrateTagMeta = async () => {
//   let mongodb = await api.DBHelper.instance
//   let tblName = (<any> awsConfig).dynamodb.VOLUNTEER_TAGS_META_TABLE_NAME
//   let tbl = dbLib.DynamoDBManager.instance().getTable<dbLib.TagMetaTable>(tblName)
//   let objs = await tbl.getAllMetaInfo()
//   objs = _.map(objs, x => {
//     x['_id'] = x.id
//     delete x.id
//     return x
//   })
//   await mongodb.insertObjects(tbl.tableName, objs)
//   console.log('DONE!')
// }

// let migrateRole = async () => {
//   let mongodb = await api.DBHelper.instance
//   let tblName = (<any> awsConfig).dynamodb.VOLUNTEER_ROLES_TABLE_NAME
//   let tbl = dbLib.DynamoDBManager.instance().getTable<dbLib.RoleTable>(tblName)
//   await tbl.forEachBatchOfAllRoles(async (objs) => {
//     objs = _.map(objs, x => {
//       x['_id'] = x.id
//       delete x.id
//       return x
//     })
//     await mongodb.insertObjects(tbl.tableName, objs)
//   })
//   console.log('DONE!')
// }

// let migratePerson = async () => {
//   let mongodb = await api.DBHelper.instance
//   let tblName = (<any> awsConfig).dynamodb.VOLUNTEER_PERSON_TABLE_NAME
//   let tbl = dbLib.DynamoDBManager.instance().getTable<dbLib.PersonTable>(tblName)
//   await tbl.forEachBatchOfAllPersons(async (objs) => {
//     objs = _.map(objs, x => {
//       x['_id'] = x.id
//       delete x.id
//       return x
//     })
//     await mongodb.insertObjects(tbl.tableName, objs)
//   })
//   console.log('DONE!')
// }

// // api.DBHelper.instance.then(db => {
// //   console.log('ok');
// // }).catch(err => {
// //   console.log(err);
// // });

// // migrateBill()
// // migrateBillType()
// // migrateBillVersion()
// // migrateBillCategory()
// // migrateTag()
// // migrateTagMeta()
// // migrateRole()
// migratePerson()