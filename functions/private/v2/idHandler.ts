import * as _ from 'lodash';
import { APIGatewayEvent, Context, Callback } from 'aws-lambda';
import { Logger } from '../../../libs/dbLib2/Logger';
import Response from '../../../libs/utils/Response';
import { QueryParamsUtils, QueryParamTypes, QueryParams } from '../../../libs/utils/QueryParamsUtils';
import { Type, DataGraph } from '../../../libs/dbLib2/DataGraph';

class IdHandler {
  static readonly PATH_PARAM_TYEPS: QueryParamTypes = {
    id: 'string[]',
  };

  static readonly QUERY_PARAM_TYEPS: QueryParamTypes = {
    field: 'string[]',
  };

  public static handleRequest (
    event: APIGatewayEvent,
    context: Context,
    callback?: Callback,
  ) {
    Logger.log(event, 'v2/idHandler')

    // This freezes node event loop when callback is invoked
    context.callbackWaitsForEmptyEventLoop = false;

    let pParams = QueryParamsUtils.parse(
      event.pathParameters,
      IdHandler.PATH_PARAM_TYEPS,
    );

    let qParams = QueryParamsUtils.parse(
      event.queryStringParameters,
      IdHandler.QUERY_PARAM_TYEPS,
    );

    IdHandler.run(
      <string[]>pParams['id'],
      <string[]>qParams['field'],
    ).then(res => Response.success(callback, JSON.stringify(res), true))
      .catch(err => Response.error(callback, JSON.stringify(err), true));
  }

  protected static async run (
    ids: string[],
    fields: string[],
  ): Promise<any> {
    let g = await DataGraph.getDefault();
    let res = await Promise.all(
      _.map(ids, async id => g.loadEntity(id, fields))
    );

    return res;
  }
}

export let main = IdHandler.handleRequest