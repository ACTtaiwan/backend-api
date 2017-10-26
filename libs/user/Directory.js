import AWS from 'aws-sdk'
import UUID from 'uuid/v4'
import JoiSchema from './Directory.schema'
import AwsConfig from '~/config/aws'

class Directory {
  constructor () {
    // get user
    this.getUser = this.getUser.bind(this)
    this._getUserById = this._getUserById.bind(this)
    this._getUserbyEmail = this._getUserbyEmail.bind(this)
    this._getUserByFbUserId = this._getUserByFbUserId.bind(this)
    // create user
    this.createUser = this.createUser.bind(this)
    this._createUserByFbUserId = this._createUserByFbUserId.bind(this)
    // update user
    this.updateLastLoggedOn = this.updateLastLoggedOn.bind(this)
    this._updateUserAttribute = this._updateUserAttribute.bind(this)
    // general
    this._genUserInfo = this._genUserInfo.bind(this)
  }

  get _awsRegion () {
    return AwsConfig.metadata.REGION
  }

  get _usersTableName () {
    return AwsConfig.dynamodb.VOLUNTEER_USERS_TABLE_NAME
  }

  getUser (params) {
    return JoiSchema.validate
      .getUserParams(params)
      .then(({ id, fbUserId, email }) => {
        if (id) {
          return this._getUserById({ id })
        } else if (fbUserId) {
          return this._getUserByFbUserId({ fbUserId })
        } else if (email) {
          return this._getUserbyEmail({ email })
        } else {
          throw new Error('INVALID_PARAMETERS')
        }
      })
      .then(user => this._genUserInfo(user))
      .then(result => Promise.resolve(result))
      .catch(error => Promise.reject(error))
  }

  _getUserById ({ id }) {
    const dynamoDb = new AWS.DynamoDB.DocumentClient({ region: this._awsRegion })
    const params = {
      TableName: this._usersTableName,
      Key: { id }
    }

    return dynamoDb
      .get(params)
      .promise()
      .then(data => Promise.resolve(data.Item))
      .catch(error => Promise.reject(error))
  }

  _getUserbyEmail ({ email }) {
    const dynamoDb = new AWS.DynamoDB.DocumentClient({ region: this._awsRegion })
    const params = {
      TableName: this._usersTableName,
      FilterExpression: 'email = :email',
      ExpressionAttributeValues: { ':email': email }
    }

    return dynamoDb
      .scan(params)
      .promise()
      .then(data => (data.Items.length ? Promise.resolve(data.Items[0]) : Promise.reject(new Error('USER_NOT_FOUND'))))
      .catch(error => Promise.reject(error))
  }

  _getUserByFbUserId ({ fbUserId }) {
    const dynamoDb = new AWS.DynamoDB.DocumentClient({ region: this._awsRegion })
    const params = {
      TableName: this._usersTableName,
      FilterExpression: 'fbUserId = :fbUserId',
      ExpressionAttributeValues: { ':fbUserId': fbUserId }
    }

    return dynamoDb
      .scan(params)
      .promise()
      .then(data => (data.Items.length ? Promise.resolve(data.Items[0]) : Promise.reject(new Error('USER_NOT_FOUND'))))
      .catch(error => Promise.reject(error))
  }

  createUser (params) {
    return JoiSchema.validate
      .createUserParams(params)
      .then(({ fbUserId }) => {
        // TODO: add more methods to create a user
        if (fbUserId) {
          return this._createUserByFbUserId(params)
        } else {
          throw new Error('INVALID_PARAMETERS')
        }
      })
      .then(user => this._genUserInfo(user))
      .then(result => Promise.resolve(result))
      .catch(error => Promise.reject(error))
  }

  _createUserByFbUserId ({ fbUserId, email, name }) {
    const dynamoDb = new AWS.DynamoDB.DocumentClient({ region: this._awsRegion })
    const params = {
      TableName: this._usersTableName,
      Item: {
        id: UUID(),
        fbUserId,
        email,
        name,
        clearedTasks: [],
        createdAt: new Date().getTime(),
        lastUpdatedAt: new Date().getTime(),
        lastLoggedOnAt: new Date().getTime()
      }
    }

    return dynamoDb
      .put(params)
      .promise()
      .then(data => Promise.resolve(params.Item))
      .catch(error => Promise.reject(error))
  }

  updateLastLoggedOn (params) {
    return JoiSchema.validate
      .updateLastLoggedOnParams(params)
      .then(params =>
        this._updateUserAttribute({
          id: params.id,
          attributeName: 'lastLoggedOnAt',
          attributeValue: new Date().getTime()
        })
      )
      .then(user => this._genUserInfo(user))
      .then(result => Promise.resolve(result))
      .catch(error => Promise.reject(error))
  }

  _updateUserAttribute ({ id, attributeName, attributeValue }) {
    const dynamoDb = new AWS.DynamoDB.DocumentClient({ region: this._awsRegion })
    const params = {
      TableName: this._usersTableName,
      Key: { id },
      UpdateExpression: 'set #attrName = :attrValue',
      ExpressionAttributeNames: { '#attrName': attributeName },
      ExpressionAttributeValues: { ':attrValue': attributeValue }
    }
    return dynamoDb
      .update(params)
      .promise()
      .then(data => {
        console.log(`update ${attributeName} successfully`)
        return this._getUserById({ id })
      })
      .catch(error => {
        console.log(`update ${attributeName} fail`, error)
        return Promise.reject(error)
      })
  }

  _genUserInfo (user) {
    const clearedTaskCount = user.clearedTasks.length
    const score = user.clearedTasks.length ? user.clearedTasks.reduce((prev, curr) => prev + curr.credit, 0) : 0

    return JoiSchema.validate.userInfo({
      id: user.id,
      fbUserId: user.fbUserId,
      email: user.email,
      score: score,
      clearedTaskCount: clearedTaskCount,
      name: user.name
    })
  }
}

export default Directory
