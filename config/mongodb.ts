import * as aws from 'aws-sdk';
import * as mongodbUri from 'mongodb-uri';
import { debug } from './debug';
import { expect } from 'chai';

export class MongoDbConfig {
  public static readonly READ_PAGE_SIZE = 500;
  public static readonly DB_NAME = 'data';

  public static readonly tableNames = {
    'BILLCATEGORIES_TABLE_NAME': 'volunteer.billCategories',
    'BILLS_TABLE_NAME': 'volunteer.bills',
    'BILLTYPES_TABLE_NAME': 'volunteer.billTypes',
    'BILLVERSIONS_TABLE_NAME': 'volunteer.billVersions',
    'PERSON_TABLE_NAME': 'volunteer.persons',
    'ROLES_TABLE_NAME': 'volunteer.roles',
    'TAGS_TABLE_NAME': 'volunteer.tags',
    'TAGS_META_TABLE_NAME': 'volunteer.tags.meta',
    'CONGRESSGOV_SYNC_BILL_TABLE_NAME': 'congressgov.sync.bill',
    'ARTICLE_SNIPPETS_TABLE_NAME': 'site.articleSnippets',
  }

  private static _remoteUrl: string

  public static get connectionUrl (): Promise<string> {
    // return MongoDbConfig.localUrl
    return MongoDbConfig.remoteUrl;
  }

  public static get localUrl (): Promise<string> {
    return Promise.resolve(`mongodb://localhost:27017/congress`)
  }

  public static get remoteUrl (): Promise<string> {
    if (debug && Array.isArray(debug['mongodb']['urls'])) {
      return Promise.resolve(debug['mongodb']['urls'][0]);
    }
    if (MongoDbConfig._remoteUrl) {
      return Promise.resolve(MongoDbConfig._remoteUrl)
    } else {
      const dbCredJson = 'digiocean_mongodb.json';
      return MongoDbConfig.getKeyFileFromS3(dbCredJson).then(json => {
        if (dbCredJson === 'digiocean_mongodb.json') {
          MongoDbConfig._remoteUrl = `mongodb://${json.admin_user}:${json.admin_pass}@${json.host}:${json.port}/congress?authSource=admin`
        } else {
          MongoDbConfig._remoteUrl = `mongodb://${json.admin_user}:${json.admin_pass}@${json.host}:${json.port}/congress?ssl=true&replicaSet=globaldb`
        }
        return MongoDbConfig._remoteUrl
      })
    }
  }

  // --------------------------------------------------

  private static async getKeyFileFromS3 (fileName: string = 'azure_mongodb.json'): Promise<any> {
    return new Promise((resolve, reject) => {
      let s3 = new aws.S3()
      var params = {
        Bucket: 'taiwanwatch-credentials',
        Key: fileName
       }
      console.log(`[MongoDbConfig::getKeyFileFromS3()] requesting S3`)
      s3.getObject(params, (err, data) => {
        if (err) {
          console.log(`[MongoDbConfig::getKeyFileFromS3()] Error = ${JSON.stringify(err, null, 2)}`)
          reject(err)
        } else {
          console.log(`[MongoDbConfig::getKeyFileFromS3()] OK. data = ` +
            `${JSON.stringify(
              data,
              (key, val) => key === 'Body' ? '<omitted>' : val,
              2
            )}`
          );
          try {
            let json = JSON.parse(data.Body.toString())
            console.log(`[MongoDbConfig::getKeyFileFromS3()] JSON parse done`)
            resolve(json)
          } catch (e) {
            console.log(`[MongoDbConfig::getKeyFileFromS3()] JSON parse failed. Error = ${e}`)
            reject(e)
          }
        }
      })
    })
  }

  private static getDebugValueMaybe (debugKey: string): any {
    if (debug && debug[debugKey]) {
      return debug[debugKey];
    }
  }

  public static async getUriComponents (debugKey = 'mongodb'): Promise<{
    username: string,
    password: string,
    host: string,
    port: number
  }> {
    let ret = this.getDebugValueMaybe(debugKey);
    if (ret === undefined) {
      ret = await MongoDbConfig.getKeyFileFromS3();
    }
    expect(ret).to.have.all.keys('username', 'password', 'host', 'port');
    return ret;
  }

  public static async getUrl (debugKey = 'mongodb'): Promise<string> {
    let urlComponents = await MongoDbConfig.getUriComponents(debugKey);
    let ret = {
      scheme: 'mongodb',
      username: urlComponents['username'],
      password: urlComponents['password'],
      hosts: [
        {
          host: urlComponents['host'],
          port: urlComponents['port']
        },
      ],
    };
    return mongodbUri.format(ret);
  }

  public static getReadPageSize (debugKey = 'mongoReadPageSize'): number {
    let ret = MongoDbConfig.getDebugValueMaybe(debugKey);
    if (ret === undefined) {
      ret = MongoDbConfig.READ_PAGE_SIZE;
    }
    return ret;
  }

  public static getDbName (debugKey = 'mongoDbName'): string {
    let ret = MongoDbConfig.getDebugValueMaybe(debugKey);
    if (ret === undefined) {
      ret = MongoDbConfig.DB_NAME;
    }
    return ret;
  }
}