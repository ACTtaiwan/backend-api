import AWS from 'aws-sdk'
// import UUID from 'uuid/v4'
import JoiSchema from './BillVersion.schema'
import AwsConfig from '~/config/aws'

class Directory {
  constructor () {
    // get bill action
    this.getVersion = this.getVersion.bind(this)
    this._getVersionById = this._getVersionById.bind(this)
    this._getVersionByCode = this._getVersionByCode.bind(this)
    // get all bill actions
    this.getList = this.getList.bind(this)
  }

  get _awsRegion () {
    return AwsConfig.metadata.REGION
  }

  get _billVersionsTableName () {
    return AwsConfig.dynamodb.VOLUNTEER_BILLVERSIONS_TABLE_NAME
  }

  getVersion (options) {
    return JoiSchema.validate
      .getVersionParams(options)
      .then(({ id, code }) => {
        if (id) {
          return this._getVersionById({ id })
        } else if (code) {
          return this._getVersionByCode({ code })
        } else {
          throw new Error('INVALID_PARAMETERS')
        }
      })
      .then(result => Promise.resolve(result))
      .catch(error => Promise.reject(error))
  }

  _getVersionById ({ id }) {
    const dynamoDb = new AWS.DynamoDB.DocumentClient({ region: this._awsRegion })
    const params = {
      TableName: this._billVersionsTableName,
      Key: { id }
    }

    return dynamoDb
      .get(params)
      .promise()
      .then(data => Promise.resolve(data.Item))
      .catch(error => Promise.reject(error))
  }

  _getVersionByCode ({ code }) {
    const dynamoDb = new AWS.DynamoDB.DocumentClient({ region: this._awsRegion })
    const params = {
      TableName: this._billVersionsTableName,
      FilterExpression: 'code = :code',
      ExpressionAttributeValues: { ':code': code }
    }

    return dynamoDb
      .scan(params)
      .promise()
      .then(
        data =>
          data.Items.length ? Promise.resolve(data.Items[0]) : Promise.reject(new Error('BILLLVERSION_NOT_FOUND'))
      )
      .catch(error => Promise.reject(error))
  }

  getList (options) {
    const dynamoDb = new AWS.DynamoDB.DocumentClient({ region: this._awsRegion })
    const params = {
      TableName: this._billVersionsTableName
    }

    return dynamoDb
      .scan(params)
      .promise()
      .then(data => Promise.resolve(data.Items))
      .catch(error => Promise.reject(error))
  }
}

export default Directory
