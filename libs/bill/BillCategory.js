import AWS from 'aws-sdk'
// import UUID from 'uuid/v4'
import JoiSchema from './BillCategory.schema'
import AwsConfig from '~/config/aws'

class Directory {
  constructor () {
    // get bill category
    this.getCategory = this.getCategory.bind(this)
    this._getCategoryById = this._getCategoryById.bind(this)
    // get all bill categories
    this.getList = this.getList.bind(this)
  }

  get _awsRegion () {
    return AwsConfig.metadata.REGION
  }

  get _billCategoriesTableName () {
    return AwsConfig.dynamodb.VOLUNTEER_BILLCATEGORIES_TABLE_NAME
  }

  getCategory (options) {
    return JoiSchema.validate
      .getCategoryParams(options)
      .then(({ id }) => {
        if (id) {
          return this._getCategoryById({ id })
        } else {
          throw new Error('INVALID_PARAMETERS')
        }
      })
      .then(result => Promise.resolve(result))
      .catch(error => Promise.reject(error))
  }

  _getCategoryById ({ id }) {
    const dynamoDb = new AWS.DynamoDB.DocumentClient({ region: this._awsRegion })
    const params = {
      TableName: this._billCategoriesTableName,
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
      TableName: this._billCategoriesTableName
    }

    return dynamoDb
      .scan(params)
      .promise()
      .then(data => Promise.resolve(data.Items))
      .catch(error => Promise.reject(error))
  }
}

export default Directory
