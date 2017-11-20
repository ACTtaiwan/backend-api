import AWS from 'aws-sdk'
import UUID from 'uuid/v4'
import AwsConfig from '~/config/aws'
import JoiSchema from './Directory.schema'
import BillVersion from './BillVersion'

class Directory {
  constructor () {
    // get bill
    this._getBillById = this._getBillById.bind(this)
    this._getBillByQuery = this._getBillByQuery.bind(this)
    // get bills
    this.getBills = this.getBills.bind(this)
    this._getBillList = this._getBillList.bind(this)
    // create bill
    this.createBill = this.createBill.bind(this)
    this._createBill = this._createBill.bind(this)
    // bill version
    this.addBillVersion = this.addBillVersion.bind(this)
    this._addBillVersionInfo = this._addBillVersionInfo.bind(this)
    this._deleteBillDoc = this._deleteBillDoc.bind(this)
    // get bill doc upload url
    this.getBillDocUploadUrl = this.getBillDocUploadUrl.bind(this)
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

  _getBillById ({ id }) {
    const dynamoDb = new AWS.DynamoDB.DocumentClient({ region: this._awsRegion })
    const params = {
      TableName: this._billsTableName,
      Key: { id }
    }

    return dynamoDb
      .get(params)
      .promise()
      .then(data => Promise.resolve(data.Item))
      .catch(error => Promise.reject(error))
  }

  _getBillByQuery (QueryParams) {
    const dynamoDb = new AWS.DynamoDB.DocumentClient({ region: this._awsRegion })
    const params = {
      TableName: this._billsTableName,
      ...QueryParams
    }
    return dynamoDb
      .scan(params)
      .promise()
      .then(data => {
        console.log('query bill', data)
        return data.Items.length ? Promise.resolve(data.Items[0]) : Promise.reject(new Error('BILL_NOT_FOUND'))
      })
      .catch(error => Promise.reject(error))
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
      .then(data => Promise.resolve(data.Items))
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
      .then(data => ({ success: true }))
      .catch(error => ({ success: false, error }))
  }

  // bill version

  addBillVersion (options) {
    let billVersion = new BillVersion()
    return JoiSchema.validate
      .addBillVersionParams(options)
      .then(options =>
        Promise.all([billVersion.getVersion({ code: options.versionCode }), this._getBillById({ id: options.billId })])
      )
      .then(([billVersion, bill]) => this._addBillVersionInfo({ ...options, bill, billVersion }))
      .then(response => Promise.resolve(response))
      .catch(error => Promise.reject(error))
  }

  _addBillVersionInfo (options) {
    let that = this
    let originalVersions = options.bill.versions ? options.bill.versions : []
    let versionHasExisted = false

    let versions = originalVersions.map(version => {
      if (version.id === options.billVersion.id) {
        console.log('version has already existed!')
        versionHasExisted = true

        let originalDocuments = version.documents ? version.documents : []
        let documentHasExisted = false

        let documents = originalDocuments.map(doc => {
          if (doc.contentType === options.contentType) {
            console.log('document type has already existed!')
            documentHasExisted = true
            that._deleteBillDoc({ bucketKey: doc.bucketKey })
            doc.bucketKey = options.bucketKey
          }
          return doc
        })

        if (!documentHasExisted) {
          documents.push({
            contentType: options.contentType,
            bucketKey: options.bucketKey
          })
        }

        version.documents = documents
      }

      return version
    })

    if (!versionHasExisted) {
      versions.push({
        ...options.billVersion,
        date: options.versionDate,
        documents: [
          {
            contentType: options.contentType,
            bucketKey: options.bucketKey
          }
        ]
      })
    }

    const dynamoDb = new AWS.DynamoDB.DocumentClient({ region: this._awsRegion })
    const params = {
      TableName: this._billsTableName,
      Key: { id: options.bill.id },
      UpdateExpression: 'set #attrName = :attrValue',
      ExpressionAttributeNames: { '#attrName': 'versions' },
      ExpressionAttributeValues: { ':attrValue': versions }
    }
    return dynamoDb
      .update(params)
      .promise()
      .then(data => this._getBillById({ id: options.bill.id }))
      .catch(error => Promise.reject(error))
  }

  _deleteBillDoc ({ bucketKey }) {
    const s3 = new AWS.S3()
    const params = {
      Bucket: this._billsBucketName,
      Key: bucketKey
    }

    return s3
      .deleteObject(params)
      .promise()
      .then(data => {
        console.log('delete version doc success')
        return Promise.resolve(data)
      })
      .catch(error => {
        console.log('delete version doc failed')
        return Promise.reject(error)
      })
  }

  // get bill doc upload url

  getBillDocUploadUrl (options) {
    return JoiSchema.validate
      .getBillDocUploadUrlParams(options)
      .then(options => this._getS3UploadUrl(options))
      .then(url => Promise.resolve({ url }))
      .catch(error => Promise.reject(error))
  }

  _getS3UploadUrl ({ congress, billId, billType, billNumber, billVersion, versionDate, contentType }) {
    const s3 = new AWS.S3()
    const type = contentType.split('/')[1]
    const params = {
      Bucket: this._billsBucketName,
      Key: `${congress}/${billType}/${billNumber}/${billId}/${billVersion.code}-${this._formatIsoDate(
        versionDate
      )}-${type}`,
      Expires: 3600,
      ACL: 'public-read',
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
