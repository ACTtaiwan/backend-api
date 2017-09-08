import AWS from 'aws-sdk'
import JoiSchema from './Logon.schema'
import AwsConfig from '~/config/aws'
import UserDirectory from '~/libs/user/Directory'

class Logon {
  constructor() {
    this.logon = this.logon.bind(this)
    this._initAuth = this._initAuth.bind(this)
    this._logUser = this._logUser.bind(this)
    this._genLogonResult = this._genLogonResult.bind(this)
  }

  get _awsRegion() {
    return AwsConfig.metadata.REGION
  }

  get _identityPoolId() {
    return AwsConfig.cognito.IDENTITY_POOL_ID
  }

  logon(params) {
    return JoiSchema.validate
      .logonParams(params)
      .then(params => this._initAuth(params))
      .then(() => this._logUser(params))
      .then(user => this._genLogonResult(user))
      .then(result => Promise.resolve(result))
      .catch(error => Promise.reject(error))
  }

  _initAuth(params) {
    let config = {
      IdentityPoolId: this._identityPoolId,
      Logins: { 'graph.facebook.com': params.fbAccessToken }
    }
    let clientConfig = { region: this._awsRegion }
    AWS.config.credentials = new AWS.CognitoIdentityCredentials(config, clientConfig)
    // when this promise gets fulfilled, the credentials
    // will be in AWS.config.credentials
    return AWS.config.credentials.getPromise()
  }

  _logUser(params) {
    let userDirectory = new UserDirectory()
    return userDirectory
      .getUser({ fbUserId: params.fbUserId })
      .then(user => userDirectory.updateLastLoggedOn(user))
      .catch(error =>
        userDirectory.createUser({
          fbUserId: params.fbUserId,
          email: params.email,
          name: params.name
        })
      )
  }

  _genLogonResult(user) {
    return JoiSchema.validate.logonSuccessfulReturns({
      status: 'LOGON_SUCCESSFUL',
      data: {
        credentail: {
          accessKeyId: AWS.config.credentials.accessKeyId,
          secretAccessKey: AWS.config.credentials.secretAccessKey,
          sessionToken: AWS.config.credentials.sessionToken
        },
        user: {
          id: user.id,
          fbUserId: user.fbUserId,
          email: user.email,
          name: user.name,
          score: user.score,
          clearedTaskCount: user.clearedTaskCount
        }
      }
    })
  }
}

export default Logon
