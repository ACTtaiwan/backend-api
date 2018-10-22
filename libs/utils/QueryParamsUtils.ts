import * as _ from 'lodash';

export interface QueryParamTypes {
  [name: string]: 'int' | 'string' | 'int[]' | 'string[]',
}

export interface QueryParams {
  [name: string]: number | string | Array<number> | Array<string>,
}

export class QueryParamsUtils {
  public static parse (
    rawParams: { [name: string]: string },
    types: QueryParamTypes,
  ): QueryParams {
    let results = {};
    _.each(rawParams, (v, k) => {
      if (!(k in types)) {
        return;
      }
      switch (types[k]) {
        case 'int':
          results[k] = Number.parseInt(v);
          break;
        case 'string':
          results[k] = decodeURIComponent(v);
          break;
        case 'int[]':
          results[k] = _.map(_.split(v, ','), tok => Number.parseInt(tok));
          break;
        case 'string[]':
          results[k] = _.map(_.split(v, ','), tok => decodeURIComponent(tok));
          break;
      }
    });

    return results;
  }
}