require('dotenv').config();
import * as express from 'express';
import * as cors from 'cors';
import { Logger } from '../libs/dbLib2';
import { Request, Response, NextFunction } from 'express';
import { ServerRoute } from './server-rest-route';
import * as AWS from 'aws-sdk';
import * as appInsights from 'applicationinsights';
import config from '../config/appConfig';

export function createApp () {
  // init Logger
  const logger = new Logger('server-rest');

  // init Application Insights (Azure telemetry)
  if (!config.isLocal && !config.isTest) {
    appInsights
      .setup(config.appInsights.key)
      .setAutoDependencyCorrelation(true)
      .setAutoCollectRequests(true)
      .setAutoCollectPerformance(true)
      .setAutoCollectExceptions(true)
      .setAutoCollectDependencies(true)
      .setAutoCollectConsole(true, true)
      .setUseDiskRetryCaching(true)
      .setSendLiveMetrics(false);
    appInsights.defaultClient.context.tags[
      appInsights.defaultClient.context.keys.cloudRole
    ] = config.appInsights.loggingAppName;
    appInsights.start();
    logger.log(
      `NODE_ENV = production. Use Application Insights. Key = ${
        config.appInsights.key
      } Role = ${config.appInsights.loggingAppName}`
    );
  } else {
    logger.log('NODE_ENV = local. Not use Application Insights.');
  }

  // log basic info
  logger.log(`STAGE = ${config.stage}`);
  logger.log(`MY_API_KEY = ${config.myAPIKey}`);
  logger.log(`IS_LOCAL = ${config.isLocal}`);
  logger.log(`IS_TEST = ${config.isTest}`);

  // set up AWS credentials
  let awsCreds: AWS.Credentials;
  if (config.aws.accessKeyId && config.aws.secretAccessKey) {
    logger.log('Use AWS creds from .env');
    awsCreds = new AWS.Credentials(config.aws);
  } else {
    logger.log('Use AWS creds from ~/.aws/credentials');
    awsCreds = new AWS.SharedIniFileCredentials();
  }
  AWS.config.credentials = awsCreds;

  function ensureAuthenticated (
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    if (req.header('x-api-key') !== config.myAPIKey) {
      res.status(401).send('Invalid API key!');
    } else {
      next();
    }
  }

  const app = express();

  // Allow all CORS
  app.use(cors());

  // Body parser (POST -> JSON)
  app.use(express.json());

  // set up all routes
  app.use('/', new ServerRoute(ensureAuthenticated).route);

  // Route Not Found (404) error w.r.t. accetp types
  app.use((req, res, next) => {
    res.status(404);

    // respond with html page
    if (req.accepts('html')) {
      res.render('404', { url: req.url });
      return;
    }

    // respond with json
    if (req.accepts('json')) {
      res.send({ error: 'Not found' });
      return;
    }

    // default to plain-text. send()
    res.type('txt').send('Not found');
  });

  return app;
}

if (require.main === module) {
  const logger = new Logger('server-rest');

  let app = createApp();

  app.listen(config.port, function () {
    logger.log(`Server is listening port ${config.port}`);
  });
}
