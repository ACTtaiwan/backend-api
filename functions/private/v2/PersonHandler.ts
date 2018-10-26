import * as _ from 'lodash';
import { Type, DataGraph } from '../../../libs/dbLib2/DataGraph';
import { translateTypeEnum } from './handlers';
import { AssocFieldResolver } from './AssocFieldResolver';
import { CongressUtils } from '../../../libs/dbLib2/CongressUtils';

export class PersonHandler {
  public static async run (
    congresses: number[],
    states: string[],
    districts: number[],
    billIds: string[],
    fields: string[],
  ): Promise<any> {
    let entQuery = { _type: Type.Person };

    let entNestedQuery = {};
    if (congresses && congresses.length > 0) {
      entNestedQuery['congressNumbers'] = congresses;
    }
    if (states && states.length > 0) {
      states = _.filter(_.map(states, CongressUtils.validateState));
      if (states.length > 0) {
        entNestedQuery['state'] = states;
      }
    }
    if (districts && districts.length > 0) {
      entNestedQuery['district'] = districts;
    }
    if (entNestedQuery !== {}) {
      entQuery['congressRoles'] = entNestedQuery;
    }

    let entAssocQueries = [];
    if (billIds && billIds.length > 0) {
      entAssocQueries.push({
        _type: [Type.Sponsor, Type.Cosponsor],
        _id2: billIds,
      });
    }

    let g = await DataGraph.getDefault();
    let ents = await g.findEntities(
      entQuery,
      entAssocQueries,
      fields,
      // [{ field: 'state', order: 'desc'}],
    );
    ents = await AssocFieldResolver.resolve(g, ents, fields);

    return _.map(ents, translateTypeEnum);
  }
}