import * as _ from 'lodash';
import { APIGatewayEvent, Context, Callback } from 'aws-lambda';
import { Logger } from '../../../libs/dbLib2/Logger';
import Response from '../../../libs/utils/Response';
import { QueryParamsUtils, QueryParamTypes, QueryParams } from '../../../libs/utils/QueryParamsUtils';
import { Type, DataGraph } from '../../../libs/dbLib2/DataGraph';

class BillHandler {
  static readonly QUERY_PARAM_TYEPS: QueryParamTypes = {
    congress: 'int[]',
    sponsor: 'string[]',
    cosponsor: 'string[]',
    tag: 'string[]',
    field: 'string[]',
  };

  public static handleRequest (
    event: APIGatewayEvent,
    context: Context,
    callback?: Callback,
  ) {
    Logger.log(event, 'v2/billHandler')

    // This freezes node event loop when callback is invoked
    context.callbackWaitsForEmptyEventLoop = false;

    let params = QueryParamsUtils.parse(
      event.queryStringParameters,
      BillHandler.QUERY_PARAM_TYEPS,
    );

    BillHandler.run(
      <number[]>params['congress'],
      <string[]>params['sponsor'],
      <string[]>params['cosponsor'],
      <string[]>params['tag'],
      <string[]>params['field'],
    ).then(res => Response.success(callback, JSON.stringify(res), true))
      .catch(err => Response.error(callback, JSON.stringify(err), true));
  }

  protected static async run (
    congresses: number[],
    sponsors: string[],
    cosponsors: string[],
    tags: string[],
    fields: string[],
  ): Promise<any> {
    let entQuery = { _type: Type.Bill };
    let entAssocQueries = [];
    if (congresses && congresses.length > 0) {
      entQuery['congress'] = congresses;
    }
    if (sponsors && sponsors.length > 0) {
      entAssocQueries.push({
        _type: Type.Sponsor,
        _id1: sponsors,
      });
    }
    if (cosponsors && cosponsors.length > 0) {
      entAssocQueries.push({
        _type: Type.Cosponsor,
        _id1: cosponsors,
      });
    }
    if (tags && tags.length > 0) {
      entAssocQueries.push({
        _type: Type.Tag,
        _id2: tags,
      });
    }

    let g = await DataGraph.getDefault();
    let res = await g.findEntities(
      entQuery,
      entAssocQueries,
      fields,
      [{ field: 'introducedDate', order: 'desc'}],
    );

    return res;
  }
}

export let main = BillHandler.handleRequest