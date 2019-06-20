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
    loggingAppName: `ustw-backend-${AppConfig.stage}`
  };
  static readonly isLocal = process.env.NODE_ENV === 'local';
  static readonly isTest = process.env.NODE_ENV === 'test';
}
