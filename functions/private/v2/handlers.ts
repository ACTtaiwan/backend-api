import * as _ from 'lodash';
import { APIGatewayEvent, Context, Callback } from 'aws-lambda';
import Response from '../../../libs/utils/Response';
import { IdHandler } from './idHandler';
import { BillHandler } from './BillHandler';
import { Type } from '../../../libs/dbLib2/DataGraph';

export type QueryParams = { [name: string]: string[] };

export function translateTypeEnum (obj: object): object {
  if (obj && obj['_type']) {
    obj['_type'] = Type[obj['_type']];
  }
  return obj;
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

  let congresses: number[] = _.map(queryParams['congress'], parseInt);
  let sponsorIds: string[] = queryParams['sponsorId'];
  let cosponsorIds: string[] = queryParams['cosponsorId'];
  let tagIds: string[] = queryParams['tagId'];
  let fields: string[] = queryParams['field'];

  BillHandler.run(congresses, sponsorIds, cosponsorIds, tagIds, fields)
    .then(res => Response.success(callback, JSON.stringify(res), true))
    .catch(err => Response.error(callback, JSON.stringify(err), true));
}