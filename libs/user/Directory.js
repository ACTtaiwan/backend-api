import AWS from 'aws-sdk'
import UUID from 'uuid/v4'
import JoiSchema from './Directory.schema'
import AwsConfig from '~/config/aws'

class Directory {
  constructor() {
    //get user
    this.getUser = this.getUser.bind(this)
    this._getUserById = this._getUserById.bind(this)
    this._getUserbyEmail = this._getUserbyEmail.bind(this)
    this._getUserByFbUserId = this._getUserByFbUserId.bind(this)
    this._genGetUserResult = this._genGetUserResult.bind(this)
    // create user
    this.createUser = this.createUser.bind(this)
    this._createUserByFbUserId = this._createUserByFbUserId.bind(this)
    this._genCreateUserResult = this._genCreateUserResult.bind(this)
    // update user
  }

  get _awsRegion() {
    return AwsConfig.metadata.REGION
  }

  get _usersTableName() {
    return AwsConfig.dynamodb.VOLUNTEER_USERS_TABLE_NAME
  }

  getUser(params) {
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
      .then(user => this._genGetUserResult(user))
      .then(result => Promise.resolve(result))
      .catch(error => Promise.reject(error))
  }

  _getUserById({ id }) {}

  _getUserbyEmail({ email }) {}

  _getUserByFbUserId({ fbUserId }) {
    const dynamoDb = new AWS.DynamoDB.DocumentClient({ region: this._awsRegion })
    const params = {
      TableName: this._usersTableName,
      FilterExpression: 'fbUserId = :fbUserId',
      ExpressionAttributeValues: { ':fbUserId': fbUserId }
    }

    return dynamoDb
      .scan(params)
      .promise()
      .then(data => {
        if (data.Items.length) {
          console.log('user found: ', JSON.stringify(data.Items[0], null, 2))
          return Promise.resolve(data.Items[0])
        }
        return Promise.reject('USER_NOT_FOUND')
      })
      .catch(error => {
        return Promise.reject(error)
      })
  }

  _genGetUserResult(user) {
    return JoiSchema.validate.getUserResult({
      id: user.id,
      fbUserId: user.fbUserId,
      email: user.email,
      score: user.score,
      clearedTaskCount: user.clearedTaskCount,
      name: user.name
    })
  }

  createUser(params) {
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
      .then(user => this._genCreateUserResult(user))
      .then(result => Promise.resolve(result))
      .catch(error => Promise.reject(error))
  }

  _createUserByFbUserId({ fbUserId, email, name }) {
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
      .then(data => {
        console.log('add user to db: ', data)
        return Promise.resolve(params.Item)
      })
      .catch(error => {
        console.log('add user to db error: ', error)
        return Promise.reject(error)
      })
  }

  _genCreateUserResult(user) {
    return JoiSchema.validate.createUserResult({
      id: user.id,
      fbUserId: user.fbUserId,
      email: user.email,
      score: user.score,
      clearedTaskCount: user.clearedTaskCount,
      name: user.name
    })
  }
}

export default Directory
