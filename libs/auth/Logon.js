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
      .then(response => this._genLogonResult(params, response))
      .then(result => Promise.resolve(result))
      .catch(error => Promise.reject(error))
  }

  _initAuth(params) {
    AWS.config.credentials = new AWS.CognitoIdentityCredentials(
      {
        IdentityPoolId: this._identityPoolId,
        Logins: {
          'graph.facebook.com': params.fbAccessToken
        }
      },
      {
        region: this._awsRegion
      }
    )
    return AWS.config.credentials.getPromise()
  }

  _logUser(params) {
    let userDirectory = new UserDirectory()
    return userDirectory
      .getUser({ fbUserId: params.fbUserId })
      .then(user => {
        console.log('found user: ', user)
        return userDirectory.updateLastLoggedOn(user)
      })
      .catch(error => {
        console.log('cannot find user: ', error)
        return userDirectory.createUser({
          fbUserId: params.fbUserId,
          email: params.email,
          name: params.name
        })
      })
  }

  _genLogonResult(params, response) {
    return JoiSchema.validate.logonSuccessfulReturns({
      status: 'LOGON_SUCCESSFUL',
      data: {
        credentail: {
          accessKeyId: AWS.config.credentials.accessKeyId,
          secretAccessKey: AWS.config.credentials.secretAccessKey,
          sessionToken: AWS.config.credentials.sessionToken
        },
        user: {
          id: response.id,
          fbUserId: response.fbUserId,
          email: response.email,
          name: response.name
        }
      }
    })
  }
}

export default Logon
