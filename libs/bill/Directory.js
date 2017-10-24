import AWS from 'aws-sdk'
import UUID from 'uuid/v4'
import AwsConfig from '~/config/aws'
import JoiSchema from './Directory.schema'
import BillType from './BillType'

class Directory {
  constructor() {
    //get bills
    this.getBills = this.getBills.bind(this)
    this._getBillList = this._getBillList.bind(this)
  }

  get _awsRegion() {
    return AwsConfig.metadata.REGION
  }

  get _billsTableName() {
    return AwsConfig.dynamodb.VOLUNTEER_BILLS_TABLE_NAME
  }

  getBills(options) {
    return JoiSchema.validate
      .getBillsParams(options)
      .then(options => {
        // here will examine what params are provided to
        // determine what kind of bill data should be returned
        // default is to return the whole bill list with some basic meta info
        return this._getBillList(options)
      })
      .then(result => {
        return Promise.resolve(result)
      })
      .catch(error => Promise.reject(error))
  }

  _getBillList(options) {
    // depends on the params provided, return the bill list
    // in, say, different order or with filters.
    const dynamoDb = new AWS.DynamoDB.DocumentClient({ region: this._awsRegion })
    const params = {
      TableName: this._billsTableName
    }
    return dynamoDb
      .scan(params)
      .promise()
      .then(async data => {
        // hydrate bill type
        let billType = new BillType()
        let bills = await Promise.all(
          data.Items.map(async bill => {
            let typeObj = await billType.getType({ id: bill.billType.id })
            return { ...bill, billType: typeObj }
          })
        )
        return Promise.resolve(bills)
      })
      .catch(error => Promise.reject(error))
  }
}

export default Directory
