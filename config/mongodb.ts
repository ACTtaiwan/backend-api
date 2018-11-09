import * as aws from 'aws-sdk';
import * as mongodbUri from 'mongodb-uri';
import { secret } from './secret';
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

  private static async getKeyFileFromS3 (fileName: string = 'digiocean_mongodb.json'): Promise<any> {
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

  private static getSecretValueMaybe (key: string): any {
    if (secret && secret[key]) {
      return secret[key];
    }
  }

  public static async getUriComponents (): Promise<{
    username: string,
    password: string,
    host: string,
    port: number
  }> {
    let key = process.env.IS_LOCAL
      ? process.env.npm_config_db_config || 'mongodb'
      : process.env.DB_CONFIG || process.env.npm_config_db_config || 'mongodb';
    let ret = this.getSecretValueMaybe(key);
    if (ret === undefined) {
      throw Error('Database config not found');
    }
    expect(ret).to.have.all.keys('username', 'password', 'host', 'port');
    return ret;
  }

  public static async getUrl (): Promise<string> {
    let urlComponents = await MongoDbConfig.getUriComponents();
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
      options: {
        authSource: 'admin'
      }
    };
    return mongodbUri.format(ret);
  }

  public static getReadPageSize (key = 'mongoReadPageSize'): number {
    let ret = MongoDbConfig.getSecretValueMaybe(key);
    if (ret === undefined) {
      ret = MongoDbConfig.READ_PAGE_SIZE;
    }
    return ret;
  }

  public static getDbName (key = 'mongoDbName'): string {
    let ret = MongoDbConfig.getSecretValueMaybe(key);
    if (ret === undefined) {
      ret = MongoDbConfig.DB_NAME;
    }
    return ret;
  }
}