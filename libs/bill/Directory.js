import AWS from 'aws-sdk'
import UUID from 'uuid/v4'
import AwsConfig from '~/config/aws'
import JoiSchema from './Directory.schema'
import BillType from './BillType'

class Directory {
  constructor () {
    // get bills
    this.getBills = this.getBills.bind(this)
    this._getBillList = this._getBillList.bind(this)
    // create bill
    this.createBill = this.createBill.bind(this)
    this._createBill = this._createBill.bind(this)
    // get s3 upload url
    this.getBillUploadUrl = this.getBillUploadUrl.bind(this)
    this._getS3UploadUrl = this._getS3UploadUrl.bind(this)
    this._formatIsoDate = this._formatIsoDate.bind(this)
  }

  get _awsRegion () {
    return AwsConfig.metadata.REGION
  }

  get _billsTableName () {
    return AwsConfig.dynamodb.VOLUNTEER_BILLS_TABLE_NAME
  }

  get _billsBucketName () {
    return AwsConfig.s3.VOLUNTEER_BILLS_BUCKET_NAME
  }

  getBills (options) {
    return JoiSchema.validate
      .getBillsParams(options)
      .then(options => {
        // here will examine what params are provided to
        // determine what kind of bill data should be returned
        // default is to return the whole bill list with some basic meta info
        return this._getBillList(options)
      })
      .then(result => Promise.resolve(result))
      .catch(error => Promise.reject(error))
  }

  _getBillList (options) {
    // depends on the params provided, return the bill list
    // in, say, different order or with filters.
    const dynamoDb = new AWS.DynamoDB.DocumentClient({ region: this._awsRegion })
    const params = { TableName: this._billsTableName }
    return dynamoDb
      .scan(params)
      .promise()
      .then(async data => {
        // hydrate bill type
        console.log('000')
        let billType = new BillType()
        let bills = await Promise.all(
          data.Items.map(async bill => {
            console.log('111', bill)
            let typeObj = await billType.getType({
              id: bill.billType.id
            })
            console.log('222', billType)
            return {
              ...bill,
              billType: typeObj
            }
          })
        )
        return Promise.resolve(bills)
      })
      .catch(error => Promise.reject(error))
  }

  createBill (options) {
    return JoiSchema.validate
      .createBillParams(options)
      .then(({ bill }) => this._createBill(bill))
      .then(response => Promise.resolve(response))
      .catch(error => Promise.reject(error))
  }

  _createBill (bill) {
    const dynamoDb = new AWS.DynamoDB.DocumentClient({ region: this._awsRegion })
    console.log('get bill', bill)
    const params = {
      TableName: this._billsTableName,
      Item: {
        id: UUID(),
        ...bill
      }
    }

    return dynamoDb
      .put(params)
      .promise()
      .then(data => {
        console.log('create bill success')
        return { success: true }
      })
      .catch(error => {
        console.log('create bill fail', error)
        return { success: false }
      })
  }

  getBillUploadUrl (options) {
    return JoiSchema.validate
      .getBillUploadUrlParams(options)
      .then(options => this._getS3UploadUrl(options))
      .then(url => Promise.resolve({ url }))
      .catch(error => Promise.reject(error))
  }

  _getS3UploadUrl ({ congress, billType, billNumber, version, versionDate, contentType }) {
    const s3 = new AWS.S3()
    const params = {
      Bucket: this._billsBucketName,
      Key: `${congress}/${billType}/${billNumber}/${version.code}-${this._formatIsoDate(versionDate)}`,
      Expires: 3600,
      ContentType: contentType
    }

    return new Promise((resolve, reject) => {
      s3.getSignedUrl('putObject', params, (error, url) => {
        if (error) {
          reject(error)
        } else {
          resolve(url)
        }
      })
    })
  }

  _formatIsoDate (sDate) {
    let date = new Date(sDate)
    const y = date.getFullYear()
    let m = date.getMonth() + 1
    m = m < 10 ? '0' + m : m
    let d = date.getDate()
    d = d < 10 ? '0' + d : d
    return `${y}${m}${d}`
  }
}

export default Directory
