import * as aws from 'aws-sdk';
import * as _ from 'lodash';
import { ISubscribeAgent } from './Subscribe.interface';
import * as request from 'request';

export class MailigenAgent implements ISubscribeAgent {
  private static _instance: MailigenAgent;

  private static LIST_ID = {
    'USTW': 'e2ceff3a',
    'ACT_CITIZENS': 'd128c719'
  };

  private apiEndpoint: string = 'http://api.mailigen.com/1.5/?output=json';
  private apiKey: string;

  private constructor () {
  }

  public static get instance (): Promise<MailigenAgent> {
    if (!MailigenAgent._instance) {
      MailigenAgent._instance = new MailigenAgent();
    }
    let agent = MailigenAgent._instance;
    return agent.getApiKeyFromS3()
      .then(cred => {
        console.log(`MailigenAgent apikey = ${cred.apiKey}`);
        agent.apiKey = cred.apiKey;
        return agent;
      });
  }

  public async subscribe (email: string, firstName?: string, lastName?: string, list?: 'act' | 'ustw' ) {
    let listId: string;
    switch (list) {
      case 'ustw':
        listId = MailigenAgent.LIST_ID.USTW;
        break;

      case 'act':
      default:
        listId = MailigenAgent.LIST_ID.ACT_CITIZENS;
    }

    let params = {
      method: 'listSubscribe',
      id: listId,
      email_address: email,
      'merge_vars[EMAIL]': email,
      email_type: 'html',
      double_optin: false,
      update_existing: true,
      send_welcome: true
    };

    if (firstName) {
      params['merge_vars[FNAME]'] = firstName;
    }

    if (lastName) {
      params['merge_vars[LNAME]'] = lastName;
    }

    return this.performRequestPOST(params);
  }

  private performRequestPOST<T> (body: any): Promise<T> {
    const opts: request.CoreOptions = {
      form: {
        apikey: this.apiKey,
        ...body
      }
    };

    // console.log(`[MailigenAgent::performRequestPOST()] opts = ${JSON.stringify(opts, null, 2)}`);

    return new Promise((resolve, reject) => {
      request.post(this.apiEndpoint, opts, (error, response, responseBody) => {
        if (!error && response.statusCode === 200) {
          let resJson: any;
          try {
            resJson = JSON.parse(responseBody);
          } catch (e) {
            resJson = undefined;
          }

          if (resJson && resJson.error) {
            reject(this.errorText(resJson.error, opts, response, resJson));
          } else {
            resolve(responseBody);
          }
        } else {
          reject(this.errorText(error, opts, response, responseBody));
        }
      });
    });
  }

  private errorText (error, opts, response, responseBody): string {
    return `[MailigenAgent::performRequestGET()]\nError = ${error}\nEndpoint = ${this.apiEndpoint}\nRequest = ${JSON.stringify(opts, null, 2)}\nRes = ${response && response.statusCode}\nBody = ${JSON.stringify(responseBody)}`;
  }

  private getApiKeyFromS3 (): Promise<{
    apiKey: string
  }> {
    return new Promise((resolve, reject) => {
      let s3 = new aws.S3();
      var params = {
        Bucket: 'taiwanwatch-credentials',
        Key: 'mailigen.json'
      };
      console.log(`[MailigenAgent::getKeyFileFromS3()] requesting S3`);
      s3.getObject(params, (err, data) => {
        if (err) {
          console.log(`[MailigenAgent::getKeyFileFromS3()] Error = ${JSON.stringify(err, null, 2)}`);
          reject(err);
        } else {
          // console.log(`[MailigenAgent::getKeyFileFromS3()] OK. data = ${JSON.stringify(data, null, 2)}`);
          try {
            let json = JSON.parse(data.Body.toString());
            console.log(`[MailigenAgent::getKeyFileFromS3()] JSON parse done`);
            resolve(json);
          } catch (e) {
            console.log(`[MailigenAgent::getKeyFileFromS3()] JSON parse failed. Error = ${e}`);
            reject(e);
          }
        }
      });
    });
  }
}
