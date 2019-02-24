import * as aws from 'aws-sdk';
import * as mailService from '@sendgrid/mail';
import * as mail from '@sendgrid/helpers/classes/mail';
import * as sgClient from '@sendgrid/client';
import {ClientRequest} from '@sendgrid/client/src/request';
import {ClientResponse} from '@sendgrid/client/src/response';
import * as api from './SendGrid.interface';
import { ISubscribeAgent } from './Subscribe.interface';

export class SendGridAgent implements ISubscribeAgent {
  private static _instance: SendGridAgent;
  private static LIST_ID = {
    'ACT_CITIZENS': 4288426,
    'ACT_FRIENDS': 4181171
  };

  public static get instance (): Promise<SendGridAgent> {
    if (!SendGridAgent._instance) {
      return SendGridAgent.getApiKeyFromS3().then(apiKey => {
        let obj = new SendGridAgent();
        sgClient.setApiKey(apiKey);
        mailService.setApiKey(apiKey);
        console.log(`[SendGridAgent::instance()] apiKey = ${apiKey}`);
        SendGridAgent._instance = obj;
        return SendGridAgent._instance;
      });
    }
    return Promise.resolve(SendGridAgent._instance);
  }

  public sendEmail () {
    let mail: mail.MailData = {
      to: {name: 'Ying-Po Liao', email: ''},
      from: {name: 'Robin Liao', email: ''},
      subject: 'Hello from USTaiwanWatch API',
      text: 'pure text content',
      html: `
        <h1>Some HTML content (by using SendGrid account)</h1>
      `
    };
    return mailService.send(mail).then(res => {
      let response = res[0] || {};
      console.log(`[SendGridAgent::sendEmail()] response = ${JSON.stringify(response, null, 2)}`);
    }).catch(err => {
      console.log(`[SendGridAgent::sendEmail()] Error = ${JSON.stringify(err, null, 2)}`);
    });
  }

  public async subscribe (email: string, firstName?: string, lastName?: string, list?: 'act' | 'ustw' ) {
    let listId = SendGridAgent.LIST_ID.ACT_CITIZENS;
    return this.addRecipient(email, firstName, lastName)
      .then(recipient_id => this.performRequest(`/contactdb/lists/${listId}/recipients/${recipient_id}`, 'POST'))
      .then(() => new Object());
  }

  private addRecipient (email: string, firstName?: string, lastName?: string): Promise<string> {
    let req: api.Request.AddRecipients = [{
      email: email,
      first_name: firstName,
      last_name: lastName
    }];
    return this.performRequest('/contactdb/recipients', 'POST', req)
      .then(apiRes => {
        let body: api.Response.AddRecipients = apiRes && apiRes.body;
        let recptId = body && body.persisted_recipients && body.persisted_recipients[0];
        return recptId || '';
      });
  }

  private performRequest (path: string, method: 'GET' | 'POST' | 'DELETE' | 'PATCH', bodyOrQs?: any): Promise<ClientResponse> {
    path = '/v3' + path;
    let req: ClientRequest = {
      url: path,
      method: method
    };
    if (bodyOrQs) {
      if (method === 'GET') {
        req.qs = bodyOrQs;
      } else {
        req.body = bodyOrQs;
      }
    }
    let sgReq = sgClient.createRequest(req);
    return sgClient.request(sgReq).then(([response, body]) => {
      console.log(`[SendGridAgent::performRequest()] REQUEST = ${JSON.stringify(sgReq, null, 2)}`);
      console.log(`[SendGridAgent::performRequest()] RESPONSE = ${JSON.stringify(response, null, 2)}`);
      return response;
    }).catch(err => {
      console.log(`[SendGridAgent::performRequest()] REQUEST = ${JSON.stringify(sgReq, null, 2)}`);
      console.log(`[SendGridAgent::performRequest()] ERROR = ${JSON.stringify(err, null, 2)}`);
      return err;
    });
  }

  private static getApiKeyFromS3 (): Promise<string> {
    return new Promise((resolve, reject) => {
      let s3 = new aws.S3();
      var params = {
        Bucket: 'taiwanwatch-credentials',
        Key: 'sendgrid.json'
      };
      console.log(`[SendGridAgent::getKeyFileFromS3()] requesting S3`);
      s3.getObject(params, (err, data) => {
        if (err) {
          console.log(`[SendGridAgent::getKeyFileFromS3()] Error = ${JSON.stringify(err, null, 2)}`);
          reject(err);
        } else {
          console.log(`[SendGridAgent::getKeyFileFromS3()] OK. data = ${JSON.stringify(data, null, 2)}`);
          try {
            let json = JSON.parse(data.Body.toString());
            console.log(`[SendGridAgent::getKeyFileFromS3()] JSON parse done`);
            resolve(json.api_key);
          } catch (e) {
            console.log(`[SendGridAgent::getKeyFileFromS3()] JSON parse failed. Error = ${e}`);
            reject(e);
          }
        }
      });
    });
  }
}
