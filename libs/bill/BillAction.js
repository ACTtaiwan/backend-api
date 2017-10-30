import AWS from 'aws-sdk'
// import UUID from 'uuid/v4'
import JoiSchema from './BillAction.schema'
import AwsConfig from '~/config/aws'

class Directory {
  constructor () {
    // get bill action
    this.getAction = this.getAction.bind(this)
    this._getActionById = this._getActionById.bind(this)
    // get all bill actions
    this.getList = this.getList.bind(this)
  }

  get _awsRegion () {
    return AwsConfig.metadata.REGION
  }

  get _billActionsTableName () {
    return AwsConfig.dynamodb.VOLUNTEER_BILLACTIONS_TABLE_NAME
  }

  getAction (options) {
    return JoiSchema.validate
      .getActionParams(options)
      .then(({ id }) => {
        if (id) {
          return this._getActionById({ id })
        } else {
          throw new Error('INVALID_PARAMETERS')
        }
      })
      .then(result => Promise.resolve(result))
      .catch(error => Promise.reject(error))
  }

  _getActionById ({ id }) {
    const dynamoDb = new AWS.DynamoDB.DocumentClient({ region: this._awsRegion })
    const params = {
      TableName: this._billActionsTableName,
      Key: { id }
    }

    return dynamoDb
      .get(params)
      .promise()
      .then(data => Promise.resolve(data.Item))
      .catch(error => Promise.reject(error))
  }

  getList (options) {
    const dynamoDb = new AWS.DynamoDB.DocumentClient({ region: this._awsRegion })
    const params = {
      TableName: this._billActionsTableName
    }

    return dynamoDb
      .scan(params)
      .promise()
      .then(data => Promise.resolve(data.Items))
      .catch(error => Promise.reject(error))
  }
}

export default Directory
