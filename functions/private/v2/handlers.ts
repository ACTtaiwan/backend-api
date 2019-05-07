import * as _ from 'lodash';
import { APIGatewayEvent, Context, Callback } from 'aws-lambda';
import Response from '../../../libs/utils/Response';
import { IdHandler } from './IdHandler';
import { BillHandler } from './BillHandler';
import { Type } from '../../../libs/dbLib2/DataGraph';
import { PersonHandler } from './PersonHandler';
import { ArticleSnippetHandler } from './ArticleSnippetHandler';
import { Logger } from '../../../libs/dbLib2/Logger';

export type RequestParams = { [ name: string ]: string[] };
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

function initHandler (
  event: APIGatewayEvent,
  context: Context,
): RequestParams {
  // This freezes node event loop when callback is invoked
  context.callbackWaitsForEmptyEventLoop = false;

  Logger.log(event, 'event');
  if (!event) {
    return {};
  }

  let queryParams = event['multiValueQueryStringParameters'];
  let pathParams = _.mapValues(event.pathParameters, v => [ v ]);

  return _.assign(queryParams, pathParams);
}

export function getStringArrayParam (p: RequestParams, name: string): string[] {
  if (!p || !p[name]) {
    return [];
  }
  return p[name];
}

export function getIntArrayParam (p: RequestParams, name: string): number[] {
  return _.map(getStringArrayParam(p, name), v => parseInt(v));
}

export function getStringArrayParamFirst (p: RequestParams, name: string): string {
  let val = getStringArrayParam(p, name);
  if (val.length > 0) {
    return val[0];
  }
}

export function getIntArrayParamFirst (p: RequestParams, name: string): number {
  let val = getIntArrayParam(p, name);
  if (val.length > 0) {
    return val[0];
  }
}


export function handleIds (
  event: APIGatewayEvent,
  context: Context,
  callback?: Callback,
) {
  let params = initHandler(event, context);
  let ids = getStringArrayParam(params, 'id');
  let fields = getStringArrayParam(params, 'field');
  let lang = getStringArrayParamFirst(params, 'lang');

  IdHandler.run(ids, fields, lang)
    .then(res => Response.success(callback, JSON.stringify(res), true))
    .catch(err => Response.error(callback, JSON.stringify(err), true));
  }

export function handleBills (
  event: APIGatewayEvent,
  context: Context,
  callback?: Callback,
) {
  let params = initHandler(event, context);
  let congresses = getIntArrayParam(params, 'congress');
  let sponsorIds = getStringArrayParam(params, 'sponsorId');
  let cosponsorIds = getStringArrayParam(params, 'cosponsorId');
  let tagIds = getStringArrayParam(params, 'tagId');
  let fields = getStringArrayParam(params, 'field');
  let lang = getStringArrayParamFirst(params, 'lang');

  BillHandler.run(congresses, sponsorIds, cosponsorIds, tagIds, fields, lang)
    .then(res => Response.success(callback, JSON.stringify(res), true))
    .catch(err => Response.error(callback, JSON.stringify(err), true));
}

export function handlePersons (
  event: APIGatewayEvent,
  context: Context,
  callback?: Callback,
) {
  let params = initHandler(event, context);
  let congresses = getIntArrayParam(params, 'congress');
  let states = getStringArrayParam(params, 'state');
  let districts = getIntArrayParam(params, 'district');
  let billIds = getStringArrayParam(params, 'sponsorId');
  let fields = getStringArrayParam(params, 'field');
  let lang = getStringArrayParamFirst(params, 'lang');

  PersonHandler.run(congresses, states, districts, billIds, fields, lang)
    .then(res => Response.success(callback, JSON.stringify(res), true))
    .catch(err => Response.error(callback, JSON.stringify(err), true));
}

export function handleArticleSnippets (
  event: APIGatewayEvent,
  context: Context,
  callback?: Callback,
) {
  let params = initHandler(event, context);
  let site = getStringArrayParamFirst(params, 'site');
  if (!isSite(site)) {
    throw Error(`Path param site contains an invalid value '${site}'`);
  }
  let before = getIntArrayParamFirst(params, 'before');
  let limit = getIntArrayParamFirst(params, 'limit');
  let fields = getStringArrayParam(params, 'field');

  ArticleSnippetHandler.run(site, before, limit, fields)
    .then(res => Response.success(callback, JSON.stringify(res), true))
    .catch(err => Response.error(callback, JSON.stringify(err), true));
}