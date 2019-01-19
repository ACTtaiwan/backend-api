import * as aws from 'aws-sdk';
import * as request from 'request';
import * as types from './PropublicaModels';

// namespace alias
import PropublicaAPITypes = types.PropublicaAPI;

export class PropublicaAPI {
  protected static readonly urlPrefix = 'https://api.propublica.org/congress/v1';

  private static _api: PropublicaAPI;

  public static get instance (): Promise<PropublicaAPI> {
    if (!PropublicaAPI._api) {
      return PropublicaAPI.getKeyFileFromS3().then(jsonCred => {
        const o = new PropublicaAPI(jsonCred.api_key);
        return o;
      });
    }
    return Promise.resolve(PropublicaAPI._api);
  }

  protected constructor (private readonly apiKey: string) {}

  public get membersAPI (): PropublicaAPIMembers {
    return new PropublicaAPIMembers(this.apiKey);
  }

  protected get<T> (url: string): Promise<T[]> {
    return new Promise((resolve, reject) => {
      request.get(url, {
        headers: {
          'x-api-key': this.apiKey
        }
      }, (err, response, body) => {
        if (err || response.statusCode !== 200) {
          reject(err);
        } else {
          resolve(JSON.parse(body).results as T[]);
        }
      })
    });
  }

  private static async getKeyFileFromS3 (): Promise<any> {
    return new Promise((resolve, reject) => {
      let s3 = new aws.S3()
      var params = {
        Bucket: 'taiwanwatch-credentials',
        Key: 'propublica.json'
       }
      console.log(`[PropublicaAPI::getKeyFileFromS3()] requesting S3`)
      s3.getObject(params, (err, data) => {
        if (err) {
          console.log(`[PropublicaAPI::getKeyFileFromS3()] Error = ${JSON.stringify(err, null, 2)}`)
          reject(err)
        } else {
          console.log(`[PropublicaAPI::getKeyFileFromS3()] OK. data = ` +
            `${JSON.stringify(
              data,
              (key, val) => key === 'Body' ? '<omitted>' : val,
              2
            )}`
          );
          try {
            let json = JSON.parse(data.Body.toString())
            console.log(`[PropublicaAPI::getKeyFileFromS3()] JSON parse done`)
            resolve(json)
          } catch (e) {
            console.log(`[PropublicaAPI::getKeyFileFromS3()] JSON parse failed. Error = ${e}`)
            reject(e)
          }
        }
      })
    })
  }
}

// "Members" API

import MembersAPITypes = PropublicaAPITypes.MembersAPI;

export class PropublicaAPIMembers extends PropublicaAPI {
  public static readonly MIN_CONGRESS_SUPPORT = 98;

  public async getMemberList (congress: number, chamber: PropublicaAPITypes.ChamberType)
  : Promise<MembersAPITypes.GetMemberListAPI.Member[]> {
    const url = `${PropublicaAPI.urlPrefix}/${congress}/${chamber}/members.json`;
    const json = await this.get<MembersAPITypes.GetMemberListAPI.Response>(url);
    return (json && json[0] && json[0].members) || null;
  }

  public async getMember (bioGuideId: string)
  : Promise<MembersAPITypes.GetMemberAPI.Member> {
    const url = `${PropublicaAPI.urlPrefix}/members/${bioGuideId}.json`;
    const json = await this.get<MembersAPITypes.GetMemberAPI.Member>(url);
    const obj = (json && json[0]) || null;
    return obj;
  }

  public async getMemberListByStateAndDistrict (chamber: PropublicaAPITypes.ChamberType, state: string, district?: number)
  : Promise<MembersAPITypes.GetMemberListByStateAndDistrict.Member[]> {
    const url = chamber === 'senate'
    ? `${PropublicaAPI.urlPrefix}/members/${chamber}/${state}/current.json`
    : `${PropublicaAPI.urlPrefix}/members/${chamber}/${state}/${district}/current.json`;
    const json = await this.get<MembersAPITypes.GetMemberListByStateAndDistrict.Member>(url);
    return json;
  }
}
