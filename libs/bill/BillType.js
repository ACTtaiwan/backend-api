import AWS from 'aws-sdk'
import UUID from 'uuid/v4'
import JoiSchema from './BillType.schema'
import AwsConfig from '~/config/aws'

class Directory {
  constructor() {
    //get bill type
    this.getType = this.getType.bind(this)
    this._getTypeById = this._getTypeById.bind(this)
  }

  get _awsRegion() {
    return AwsConfig.metadata.REGION
  }

  get _billTypesTableName() {
    return AwsConfig.dynamodb.VOLUNTEER_BILLTYPES_TABLE_NAME
  }

  getType(options) {
    return JoiSchema.validate
      .getTypeParams(options)
      .then(({ id }) => {
        if (id) {
          return this._getTypeById({ id })
        } else {
          throw new Error('INVALID_PARAMETERS')
        }
      })
      .then(result => Promise.resolve(result))
      .catch(error => Promise.reject(error))
  }

  _getTypeById({ id }) {
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
}

export default Directory
