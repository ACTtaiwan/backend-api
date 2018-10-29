import * as _ from 'lodash';
import { APIGatewayEvent, Context, Callback } from 'aws-lambda';
import Response from '../../../libs/utils/Response';
import { IdHandler } from './idHandler';
import { BillHandler } from './BillHandler';
import { Type } from '../../../libs/dbLib2/DataGraph';
import { PersonHandler } from './PersonHandler';
import { ArticleSnippetHandler } from './ArticleSnippetHandler';

export type QueryParams = { [name: string]: string[] };
export type Site = 'act' | 'ustw';
export function isSite (o: any): o is Site {
  return o === 'act' || o === 'ustw';
}
export type Timestamp = number;

export function translateTypeEnum (obj: object): object {
  if (obj && obj['_type']) {
    obj['_type'] = Type[obj['_type']];
  }
  return obj;
}

function toIntArray (strs: string[]): number[] {
  return _.map(strs, s => parseInt(s));
}

function toFloatArray (strs: string[]): number[] {
  return _.map(strs, s => parseFloat(s));
}

export function handleIds (
  event: APIGatewayEvent,
  _context: Context,
  callback?: Callback,
) {
  let queryParams: QueryParams = event['multiValueQueryStringParameters'];

  let ids: string[] = queryParams['id'];
  let fields: string[] = queryParams['field'];

  IdHandler.run(ids, fields)
    .then(res => Response.success(callback, JSON.stringify(res), true))
    .catch(err => Response.error(callback, JSON.stringify(err), true));
}

export function handleBills (
  event: APIGatewayEvent,
  _context: Context,
  callback?: Callback,
) {
  let queryParams: QueryParams = event['multiValueQueryStringParameters'];

  let congresses: number[] = toIntArray(queryParams['congress']);
  let sponsorIds: string[] = queryParams['sponsorId'];
  let cosponsorIds: string[] = queryParams['cosponsorId'];
  let tagIds: string[] = queryParams['tagId'];
  let fields: string[] = queryParams['field'];

  BillHandler.run(congresses, sponsorIds, cosponsorIds, tagIds, fields)
    .then(res => Response.success(callback, JSON.stringify(res), true))
    .catch(err => Response.error(callback, JSON.stringify(err), true));
}

export function handlePersons (
  event: APIGatewayEvent,
  _context: Context,
  callback?: Callback,
) {
  let queryParams: QueryParams = event['multiValueQueryStringParameters'];

  let congresses: number[] = toIntArray(queryParams['congress']);
  let states: string[] = queryParams['state'];
  let districts: number[] = toIntArray(queryParams['state']);
  let billIds: string[] = queryParams['sponsorId'];
  let fields: string[] = queryParams['field'];

  PersonHandler.run(congresses, states, districts, billIds, fields)
    .then(res => Response.success(callback, JSON.stringify(res), true))
    .catch(err => Response.error(callback, JSON.stringify(err), true));
}

export function handleArticleSnippets (
  event: APIGatewayEvent,
  _context: Context,
  callback?: Callback,
) {
  let queryParams: QueryParams = event['multiValueQueryStringParameters'];
  let pathParams = event.pathParameters;

  let site = pathParams['site'];
  if (!isSite(site)) {
    throw Error(`Path param site contains an invalid value `
      + `${pathParams['site']}`);
  }
  let beforeParams: number[] = toFloatArray(queryParams['before']);
  let before = beforeParams && beforeParams.length > 0 ?
    beforeParams[beforeParams.length - 1] :
    undefined;
  let limitParams: number[] = toIntArray(queryParams['limit']);
  let limit = limitParams && limitParams.length > 0 ?
    limitParams[limitParams.length - 1] :
    undefined;
  let fields: string[] = queryParams['field'];

  ArticleSnippetHandler.run(site, before, limit, fields)
    .then(res => Response.success(callback, JSON.stringify(res), true))
    .catch(err => Response.error(callback, JSON.stringify(err), true));
}