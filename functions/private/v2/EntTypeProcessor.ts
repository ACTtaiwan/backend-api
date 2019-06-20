import * as _ from 'lodash';
import { RequestHandlerBase } from './RequestHandlerBase';
import { IEnt, Type } from '../../../libs/dbLib2';
import { RequestParams } from './RequestParams';

export class EntTypeProcessor<T> extends RequestHandlerBase<T> {
  protected async preProcess (_params: RequestParams): Promise<boolean> {
    return true;
  }

  protected async postProcess (_p: RequestParams, results: T[]): Promise<T[]> {
    return _.map(results, ent => {
      if (ent && ent['_type']) {
        ent['_type'] = Type[ent['_type']];
      }
      return ent;
    });
  }
}
