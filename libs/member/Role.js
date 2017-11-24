import AWS from 'aws-sdk'
// import UUID from 'uuid/v4'
import JoiSchema from './Role.schema'
import AwsConfig from '~/config/aws'

class Directory {
  constructor () {
    // get a specific role
    this.getRole = this.getRole.bind(this)
    this._getRoleById = this._getRoleById.bind(this)
    // get a list of roles
    this.getRoles = this.getRoles.bind(this)
    this._getRoleList = this._getRoleList.bind(this)
  }

  get _awsRegion () {
    return AwsConfig.metadata.REGION
  }

  get _rolesTableName () {
    return AwsConfig.dynamodb.VOLUNTEER_ROLES_TABLE_NAME
  }

  getRole (options) {
    return JoiSchema.validate
      .getRoleParams(options)
      .then(({ id }) => {
        if (id) {
          return this._getRoleById({ id })
        } else {
          throw new Error('INVALID_PARAMETERS')
        }
      })
      .then(result => Promise.resolve(result))
      .catch(error => Promise.reject(error))
  }

  _getRoleById ({ id }) {
    const dynamoDb = new AWS.DynamoDB.DocumentClient({ region: this._awsRegion })
    const params = {
      TableName: this._rolesTableName,
      Key: { id }
    }

    return dynamoDb
      .get(params)
      .promise()
      .then(data => Promise.resolve(data.Item))
      .catch(error => Promise.reject(error))
  }

  getRoles (options) {
    return JoiSchema.validate
      .getRolesParams(options)
      .then(({ query }) => {
        if (query && query.name) {
          const nameQueryParam = this._genNameQueryParam(query.name)
          return this._getRolesByQuery(nameQueryParam)
        } else {
          return this._getRoleList(options)
        }
      })
      .then(result => Promise.resolve(result))
      .catch(error => Promise.reject(error))
  }

  _getRoleList (options) {
    const dynamoDb = new AWS.DynamoDB.DocumentClient({ region: this._awsRegion })
    const params = { TableName: this._rolesTableName }
    return dynamoDb
      .scan(params)
      .promise()
      .then(data => Promise.resolve(data.Items))
      .catch(error => Promise.reject(error))
  }

  _genNameQueryParam (name) {
    // return {
    //   QueryFilters: {
    //     'person.firstname': {
    //       ComparisonOperator: 'CONTAINS',
    //       AttributeValueList: [{ S: name }]
    //     },
    //     'person.middlename': {
    //       ComparisonOperator: 'CONTAINS',
    //       AttributeValueList: [{ S: name }]
    //     },
    //     'person.lastname': {
    //       ComparisonOperator: 'CONTAINS',
    //       AttributeValueList: [{ S: name }]
    //     }
    //   }
    // }
    return {
      FilterExpression: 'contains(person.searchName, :name)',
      ExpressionAttributeValues: {
        ':name': name.toLowerCase()
      }
    }
  }

  _getRolesByQuery (QueryParams) {
    const dynamoDb = new AWS.DynamoDB.DocumentClient({ region: this._awsRegion })
    const params = {
      TableName: this._rolesTableName,
      ...QueryParams
    }

    return dynamoDb
      .scan(params)
      .promise()
      .then(data => Promise.resolve(data.Items))
      .catch(error => Promise.reject(error))
  }
}

export default Directory
