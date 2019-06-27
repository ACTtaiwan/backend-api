require('dotenv').config();
import * as mongodbUri from 'mongodb-uri';
import * as _ from 'lodash';

export default class AppConfig {
  static readonly stage = process.env.STAGE || 'dev';
  static readonly port = process.env.port || process.env.PORT || 9487;
  static readonly myAPIKey = process.env.MY_API_KEY;
  static readonly aws = {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  };
  static readonly appInsights = {
    key: process.env.APPINSIGHTS_INSTRUMENTATIONKEY,
    loggingAppName: `ustw-backend-${AppConfig.stage}`,
  };
  static readonly isLocal = process.env.NODE_ENV === 'local';
  static readonly isTest = process.env.NODE_ENV === 'test';

  static readonly mongodbUsername = process.env.MONGODB_USERNAME || '';
  static readonly mongodbPassword = process.env.MONGODB_PASSWORD || '';
  static readonly mongodbHost = process.env.MONGODB_HOST || 'localhost';
  static readonly mongodbPort = _.parseInt(process.env.MONGODB_PORT) || 27017;
  static readonly mongodbUrl = mongodbUri.format(
    {
      scheme: 'mongodb',
      username: AppConfig.mongodbUsername,
      password: AppConfig.mongodbPassword,
      hosts: [
        {
          host: AppConfig.mongodbHost,
          port: AppConfig.mongodbPort,
        },
      ],
      options: {
        authSource: 'admin',
      },
    }
  );
  static readonly mongodbUrlLocal = mongodbUri.format(
    {
      scheme: 'mongodb',
      username: '',
      password: '',
      hosts: [
        {
          host: 'localhost',
          port: 27017,
        },
      ],
      options: {
        authSource: 'admin',
      },
    }
  );
  static readonly mongodbReadPageSize = _.parseInt(
    process.env.MONGODB_READ_PAGESIZE
  ) || 500;
  static readonly airtableApiKey = process.env.AIRTABLE_APIKEY;
  static readonly sendPulseEncrypSecret = process.env.SENDPULSE_ENCRYPT_SECRET;
}
