import AWS from 'aws-sdk'
// import UUID from 'uuid/v4'
import JoiSchema from './BillType.schema'
import AwsConfig from '~/config/aws'

class Directory {
  constructor () {
    // get bill type
    this.getType = this.getType.bind(this)
    this._getTypeById = this._getTypeById.bind(this)
    this._getTypeByCode = this._getTypeByCode.bind(this)
    // get all bill types
    this.getList = this.getList.bind(this)
  }

  get _awsRegion () {
    return AwsConfig.metadata.REGION
  }

  get _billTypesTableName () {
    return AwsConfig.dynamodb.VOLUNTEER_BILLTYPES_TABLE_NAME
  }

  getType (options) {
    return JoiSchema.validate
      .getTypeParams(options)
      .then(({ id, code }) => {
        if (id) {
          return this._getTypeById({ id })
        } else if (code) {
          return this._getTypeByCode({ code })
        } else {
          throw new Error('INVALID_PARAMETERS')
        }
      })
      .then(result => Promise.resolve(result))
      .catch(error => Promise.reject(error))
  }

  _getTypeById ({ id }) {
    const dynamoDb = new AWS.DynamoDB.DocumentClient({ region: this._awsRegion })
    const params = {
      TableName: this._billTypesTableName,
      Key: { id }
    }

    return dynamoDb
      .get(params)
      .promise()
      .then(data => Promise.resolve(data.Item))
      .catch(error => Promise.reject(error))
  }

  _getTypeByCode ({ code }) {
    const dynamoDb = new AWS.DynamoDB.DocumentClient({ region: this._awsRegion })
    const params = {
      TableName: this._billTypesTableName,
      FilterExpression: 'code = :code',
      ExpressionAttributeValues: { ':code': code }
    }

    return dynamoDb
      .scan(params)
      .promise()
      .then(
        data => (data.Items.length ? Promise.resolve(data.Items[0]) : Promise.reject(new Error('BILLLTYPE_NOT_FOUND')))
      )
      .catch(error => Promise.reject(error))
  }

  getList (options) {
    const dynamoDb = new AWS.DynamoDB.DocumentClient({ region: this._awsRegion })
    const params = {
      TableName: this._billTypesTableName
    }

    return dynamoDb
      .scan(params)
      .promise()
      .then(data => Promise.resolve(data.Items))
      .catch(error => Promise.reject(error))
  }
}

export default Directory
