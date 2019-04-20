import { ArrayFieldFilters } from '../../../libs/dbLib2';
import * as _ from 'lodash';

export class CongressRoleFilter {

  private static parseField (field: string): [string, number] {
    let tok = _.split(field, '#');
    if (tok && tok.length === 2 && tok[0] === 'congressRoles') {
      let ts = _.parseInt(tok[1]);
      if (!_.isNaN(ts)) {
        return [tok[0], ts];
      }
    }
  }

  private static composeFilteringQuery (ts: number) {
    if (ts) {
      return {
        startDate: {
          _op: '<=',
          _val: ts,
        },
        endDate: {
          _op: '>',
          _val: ts,
        },
      };
    }
  }

  public static getFieldFilters (
    fields: string[],
    resultFilters: ArrayFieldFilters,
  ): string[] {
    let parsed = _.chain(fields)
      .map(f => [f, this.parseField(f)])
      .fromPairs()
      .pickBy()
      .value();
    let resultFields = _.map(fields, f => {
      if (parsed[f]) {
        resultFilters[parsed[f][0]] = this.composeFilteringQuery(parsed[f][1]);
        return parsed[f][0];
      } else {
        return f;
      }
    });

    return resultFields;
  }
}