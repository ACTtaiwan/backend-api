import { Context, Callback, APIGatewayEvent } from 'aws-lambda'
import Response from '../../../libs/utils/Response'
import * as _ from 'lodash'
import { MongoDBManager, ArticleSnippetsTable, ArticleSnippet } from '../../../libs/mongodbLib';
import { MongoDbConfig } from '../../../config/mongodb';

export class ArticleSnippetsHandler {
  public static handleRequest (event: APIGatewayEvent, context: Context, callback?: Callback) {
    console.log(`[ArticleSnippetsHandler::handleRequest()] event = ${JSON.stringify(event, null, 2)}`)

    // This freezes node event loop when callback is invoked
    context.callbackWaitsForEmptyEventLoop = false;

    let params = {
      before: (
        event.queryStringParameters &&
        event.queryStringParameters.before
      ) || undefined,
      limit: (
        event.queryStringParameters &&
        event.queryStringParameters.limit
      ) || '10',
    };

    (new Promise<ArticleSnippet[]>(
      async (resolve, _reject) => {
        let db = await MongoDBManager.instance;
        let table = db.getTable<ArticleSnippetsTable>(
          MongoDbConfig.tableNames.ARTICLE_SNIPPETS_TABLE_NAME,
        );
        let res = await table.list(
          parseInt(params.limit),
          [],
          parseInt(params.before),
        );
        if (res) {
          resolve(res);
        } else {
          resolve([]);
        }
      }
    )).then(
      results => Response.success(callback, JSON.stringify(results), true),
      error => Response.error(callback, JSON.stringify(error), true),
    );
  }
}

export let main = ArticleSnippetsHandler.handleRequest
