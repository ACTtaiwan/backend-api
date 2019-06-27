import * as aws from 'aws-sdk';
import { ISubscribeAgent } from './Subscribe.interface';
import * as request from 'request';
import * as _ from 'lodash';
import * as crypto from 'crypto';
import html from './UnsubscribeConfirm.html';
import * as format from 'string-template';
import config from '../../config/appConfig';

export class SendPulseAgent implements ISubscribeAgent {
  private static _instance: SendPulseAgent;
  private static LIST_ID = {
    'ACT_CITIZENS': '2014765',
    'ACT_FRIENDS': '2047838',
    'TAIWAN_CULTURE': '2047843',
    'USTW': '2048092'
  };

  private static SENDER_EMAIL = {
    'ACT_CITIZENS': 'fellowcitizens@ACTtaiwan.org',
    'ACT_FRIENDS': 'FriendsofACT@ACTtaiwan.org',
    'TAIWAN_CULTURE': 'FriendsofACT@ACTtaiwan.org',
    'USTW': 'liho@uswatch.tw'
  };

  private token: string;

  private constructor () {
  }

  public static get instance (): Promise<SendPulseAgent> {
    if (!SendPulseAgent._instance) {
      SendPulseAgent._instance = new SendPulseAgent();
    }
    let agent = SendPulseAgent._instance;
    return agent.getApiKeyFromS3()
      .then(cred => agent.fetchToken(cred.client_id, cred.client_secret))
      .then(token => {
        console.log(`SendPulse token = ${token}`);
        agent.token = token;
        return agent;
      });
  }

  public async subscribe (email: string, firstName?: string, lastName?: string, list?: 'act' | 'ustw' ) {
    let listId: string;
    let senderEmail: string;
    switch (list) {
      case 'ustw':
        listId = SendPulseAgent.LIST_ID.USTW;
        senderEmail = SendPulseAgent.SENDER_EMAIL.USTW;
        break;

      case 'act':
      default:
        listId = SendPulseAgent.LIST_ID.ACT_CITIZENS;
        senderEmail = SendPulseAgent.SENDER_EMAIL.ACT_CITIZENS;
    }
    return this.addRecipient(listId, senderEmail, email, firstName, lastName, list === 'act').then(() => {
      if (list === 'ustw') {
        return this.sendUSTWWelcomeEmail(list, email, firstName, lastName);
      }
    });
  }

  // return resulting html page
  public async unsubscribe (email: string, verifyCode: string, list?: 'act' | 'ustw'): Promise<string> {
    let listId: string;
    switch (list) {
      case 'act':
        listId = SendPulseAgent.LIST_ID.ACT_CITIZENS;
        break;

      case 'ustw':
      default:
        listId = SendPulseAgent.LIST_ID.USTW;
    }
    return this.deleteRecipient(listId, email, verifyCode)
      .then(() => format(html, {
        MESSAGE_INFO: `很遺憾您無法繼續訂閱我們的消息，您的Email：${email}已經確認取消訂閱。`
      }))
      .catch(() => format(html, {
        MESSAGE_INFO: `您的Email：${email}取消訂閱失敗！<br/>請過幾分鐘後重試。若仍有任何問題請與我們聯繫：uswatch@acttaiwan.org`
      }));
  }

  public addRecipient (listId: string, sender_email: string, email: string, firstName?: string, lastName?: string, doubleOptIn: boolean = true): Promise<void> {
    const varName_FirstName = 'First Name';
    const varName_LastName = 'Last Name';
    const varObj = {};
    firstName && (varObj[ varName_FirstName ] = firstName);
    lastName && (varObj[ varName_LastName ] = lastName);

    const endpoint = `https://api.sendpulse.com/addressbooks/${listId}/emails${doubleOptIn ? '?confirmation=force' : ''}`;
    const payload = {
      sender_email,
      emails: [{
        email,
        variables: varObj
      }]
    };

    return this.performRequestPOST<{result: boolean}>(endpoint, payload)
      .then(res =>
        (res && res.result)
          ? Promise.resolve()
          : Promise.reject(`[SendPulseAgent::addRecipient] Failed = ${JSON.stringify(res, null, 2)}`)
      );
  }

  public deleteRecipient (listId: string, email: string, verifyCode: string): Promise<void> {
    const check = this.encrypt(email) === verifyCode;
    if (!check) {
      return Promise.reject('verification code is invalid');
    }

    const endpoint = `https://api.sendpulse.com/addressbooks/${listId}/emails`;
    const payload = {
      emails: [email]
    };
    return this.performRequestDELETE(endpoint, payload);
  }

  private async sendUSTWWelcomeEmail (list: 'act' | 'ustw', email: string, firstName: string = '', lastName: string = '') {
    const templates = await this.performRequestGET<any[]>('https://api.sendpulse.com/templates');
    const templateId = _.find(templates, t => t.real_id === 860563);
    const endpoint = `https://api.sendpulse.com/smtp/emails`;
    const payload = {
      'email': {
        'subject': '歡迎光臨美國國會台灣觀測站',
        'from': {
          'name': 'U.S. Taiwan Watch 美國國會台灣觀測站',
          'email': 'uswatch@acttaiwan.org'
        },
        'to': [{
          'name': `${firstName}${lastName}`,
          'email': email
        }],
        'template': {
          'id': templateId,
          'variables': {
            'First Name': `${firstName}${lastName}`,
            'unsubscribe_url': `https://api.uswatch.tw/${process.env.CURRENT_STAGE}/unsubscribe/${list}?email=${email}&code=${this.encrypt(email)}`
          }
       }
      }
    };

    console.log(`[SendPulseAgent::sendUSTWWelcomEmail] payload = ${JSON.stringify(payload, null, 2)}`);

    return this.performRequestPOST<{result: boolean}>(endpoint, payload)
      .then(res =>
        (res && res.result)
          ? Promise.resolve()
          : Promise.reject(`[SendPulseAgent::sendUSTWWelcomEmail] Failed = ${JSON.stringify(res, null, 2)}`)
      );
  }

  private fetchToken (client_id: string, client_secret: string): Promise<string> {
    const body = {
      grant_type: 'client_credentials',
      client_id,
      client_secret
    };

    return this.performRequestPOST<{
      access_token: string
      token_type: string,
      expires_in: number
    }>('https://api.sendpulse.com/oauth/access_token', body)
      .then(body => body.access_token);
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
      };
      console.log(`[SendPulseAgent::getKeyFileFromS3()] requesting S3`);
      s3.getObject(params, (err, data) => {
        if (err) {
          console.log(`[SendPulseAgent::getKeyFileFromS3()] Error = ${JSON.stringify(err, null, 2)}`);
          reject(err);
        } else {
          // console.log(`[SendPulseAgent::getKeyFileFromS3()] OK. data = ${JSON.stringify(data, null, 2)}`);
          try {
            let json = JSON.parse(data.Body.toString());
            console.log(`[SendPulseAgent::getKeyFileFromS3()] JSON parse done`);
            resolve(json);
          } catch (e) {
            console.log(`[SendPulseAgent::getKeyFileFromS3()] JSON parse failed. Error = ${e}`);
            reject(e);
          }
        }
      });
    });
  }

  private performRequestPOST<T> (endpoint: string, body: any): Promise<T> {
    const opts: request.CoreOptions = {
      json: body
    };

    if (this.token) {
      opts.auth = { bearer: this.token };
    }

    return new Promise((resolve, reject) => {
      request.post(endpoint, opts, (error, response, responseBody) => {
        if (!error && response.statusCode === 200) {
          resolve(responseBody);
        } else {
          reject(this.errorText(error, endpoint, opts, response, responseBody));
        }
      });
    });
  }

  private performRequestGET<T> (endpoint: string): Promise<T> {
    const opts: request.CoreOptions = {};

    if (this.token) {
      opts.auth = { bearer: this.token };
    }

    return new Promise((resolve, reject) => {
      request.get(endpoint, opts, (error, response, responseBody) => {
        if (!error && response.statusCode === 200) {
          resolve(JSON.parse(responseBody));
        } else {
          reject(this.errorText(error, endpoint, opts, response, responseBody));
        }
      });
    });
  }

  private performRequestDELETE (endpoint: string, body: any): Promise<any> {
    const opts: request.CoreOptions = {
      json: body
    };

    if (this.token) {
      opts.auth = { bearer: this.token };
    }

    console.log(`[SendPulseAgent::performRequestDELETE] endpoint = ${endpoint}\nopts = ${JSON.stringify(opts, null, 2)}`);
    return new Promise((resolve, reject) => {
      request.del(endpoint, opts, (error, response, responseBody) => {
        if (!error && response.statusCode === 200) {
          resolve(responseBody);
        } else {
          reject(this.errorText(error, endpoint, opts, response, responseBody));
        }
      });
    });
  }

  private errorText (error, endpoint, opts, response, responseBody): string {
    return `[SendPulseAgent::performRequestGET()]\nError = ${error}\nEndpoint = ${endpoint}\nRequest = ${JSON.stringify(opts, null, 2)}\nRes = ${response && response.statusCode}\nBody = ${JSON.stringify(responseBody)}`;
  }

  private encrypt (email: string): string {
    var hash = crypto.createHash('sha256')
    .update(email + config.sendPulseEncrypSecret)
    .digest('hex');
   return hash;
  }
}
