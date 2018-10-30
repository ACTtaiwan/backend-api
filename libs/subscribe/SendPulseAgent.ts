import * as aws from 'aws-sdk'
import { ISubscribeAgent } from './Subscribe.interface';
import * as request from 'request'

export class SendPulseAgent implements ISubscribeAgent {
  private static _instance: SendPulseAgent;
  private static LIST_ID = {
    'ACT_CITIZENS': '2014765',
    'ACT_FRIENDS': '2047838',
    'TAIWAN_CULTURE': '2047843',
    'USTW': '2048092'
  }

  private static SENDER_EMAIL = {
    'ACT_CITIZENS': 'fellowcitizens@ACTtaiwan.org',
    'ACT_FRIENDS': 'FriendsofACT@ACTtaiwan.org',
    'TAIWAN_CULTURE': 'FriendsofACT@ACTtaiwan.org',
    'USTW': 'liho@uswatch.tw'
  }

  private token: string;

  private constructor () {
  }

  public static get instance (): Promise<SendPulseAgent> {
    if (!SendPulseAgent._instance) {
      SendPulseAgent._instance = new SendPulseAgent()
    }
    let agent = SendPulseAgent._instance;
    return agent.getApiKeyFromS3()
      .then(cred => agent.fetchToken(cred.client_id, cred.client_secret))
      .then(token => {
        agent.token = token;
        return agent;
      });
  }

  public async subscribe (email: string, firstName?: string, lastName?: string, list?: 'act' | 'ustw' ) {
    let listId: string;
    let senderEmail: string;
    switch (list) {
      case 'ustw':
        listId = SendPulseAgent.LIST_ID.USTW
        senderEmail = SendPulseAgent.SENDER_EMAIL.USTW
        break;

      case 'act':
      default:
        listId = SendPulseAgent.LIST_ID.ACT_CITIZENS
        senderEmail = SendPulseAgent.SENDER_EMAIL.ACT_CITIZENS
    }
    return this.addRecipient(listId, senderEmail, email, firstName, lastName)
  }

  private addRecipient (listId: string, sender_email: string, email: string, firstName?: string, lastName?: string): Promise<void> {
    const varName_FirstName = 'First Name'
    const varName_LastName = 'Last Name'
    const varObj = {}
    firstName && (varObj[ varName_FirstName ] = firstName)
    lastName && (varObj[ varName_LastName ] = lastName)

    const endpoint = `https://api.sendpulse.com/addressbooks/${listId}/emails?confirmation=force`
    const payload = {
      sender_email,
      emails: [{
        email,
        variables: varObj
      }]
    }

    return this.performRequestPOST<{result: boolean}>(endpoint, payload)
      .then(res =>
        (res && res.result)
          ? Promise.resolve()
          : Promise.reject(`[SendPulseAgent::addRecipient] Failed = ${JSON.stringify(res, null, 2)}`)
      )
  }

  private fetchToken (client_id: string, client_secret: string): Promise<string> {
    const body = {
      grant_type: 'client_credentials',
      client_id,
      client_secret
    }

    return this.performRequestPOST<{
      access_token: string
      token_type: string,
      expires_in: number
    }>('https://api.sendpulse.com/oauth/access_token', body)
      .then(body => body.access_token)
  }

  private getApiKeyFromS3 (): Promise<{
    client_id: string,
    client_secret: string
  }> {
    return new Promise((resolve, reject) => {
      let s3 = new aws.S3();
      var params = {
        Bucket: 'taiwanwatch-credentials',
        Key: 'sendpulse.json'
      }
      console.log(`[SendPulseAgent::getKeyFileFromS3()] requesting S3`)
      s3.getObject(params, (err, data) => {
        if (err) {
          console.log(`[SendPulseAgent::getKeyFileFromS3()] Error = ${JSON.stringify(err, null, 2)}`)
          reject(err)
        } else {
          console.log(`[SendPulseAgent::getKeyFileFromS3()] OK. data = ${JSON.stringify(data, null, 2)}`)
          try {
            let json = JSON.parse(data.Body.toString())
            console.log(`[SendPulseAgent::getKeyFileFromS3()] JSON parse done`)
            resolve(json)
          } catch (e) {
            console.log(`[SendPulseAgent::getKeyFileFromS3()] JSON parse failed. Error = ${e}`)
            reject(e)
          }
        }
      })
    })
  }

  private performRequestPOST<T> (endpoint: string, body: any): Promise<T> {
    const opts: request.CoreOptions = {
      json: body
    }

    if (this.token) {
      opts.auth = { bearer: this.token }
    }

    return new Promise((resolve, reject) => {
      request.post(endpoint, opts, (error, response, responseBody) => {
        if (!error && response.statusCode === 200) {
          resolve(responseBody)
        } else {
          reject(`[SendPulseAgent::performRequestPOST()]
            Error = ${error}
            Endpoint = ${endpoint}
            Request = ${JSON.stringify(opts, null, 2)}
            Res = ${response && response.statusCode}
            Body = ${responseBody}`)
        }
      })
    })
  }
}
