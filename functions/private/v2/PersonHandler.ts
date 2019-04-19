import * as _ from 'lodash';
import { Type, DataGraph, ArrayFieldFilters } from '../../../libs/dbLib2/DataGraph';
import { translateTypeEnum } from './handlers';
import { AssocFieldResolver } from './AssocFieldResolver';
import { CongressUtils } from '../../../libs/dbLib2/CongressUtils';
import { LanguageHelper } from './LanguageHelper';
import { CongressRoleFilter } from './CongressRoleFilter';

export class PersonHandler {
  public static async run (
    congresses: number[],
    states: string[],
    districts: number[],
    billIds: string[],
    fields: string[],
    lang?: string,
  ): Promise<any> {
    let entQuery = { _type: Type.Person };

    let nestedQuery = {};
    if (congresses && congresses.length > 0) {
      nestedQuery['congressNumbers'] = congresses;
    }
    if (states && states.length > 0) {
      states = _.filter(_.map(states, CongressUtils.validateState));
      if (states.length > 0) {
        nestedQuery['state'] = states;
      }
    }
    if (districts && districts.length > 0) {
      nestedQuery['district'] = districts;
    }
    if (nestedQuery !== {}) {
      entQuery['congressRoles'] = {
        _op: 'has_any',
        _val: nestedQuery,
      };
    }

    let entAssocQueries = [];
    if (billIds && billIds.length > 0) {
      entAssocQueries.push({
        _type: [Type.Sponsor, Type.Cosponsor],
        _id2: billIds,
      });
    }

    let g = await DataGraph.getDefault();
    fields = LanguageHelper.augmentFields(fields, lang);

    let fieldFilters: ArrayFieldFilters = {};
    fields = CongressRoleFilter.getFieldFilters(fields, fieldFilters);

    let ents = await g.findEntities(
      entQuery,
      entAssocQueries,
      fields,
      [
        { field: 'lastName', order: 'asc' },
        { field: 'firstName', order: 'asc' },
        { field: 'middleName', order: 'asc' },
      ],
      undefined,
      undefined,
      fieldFilters,
    );
    ents = await AssocFieldResolver.resolve(g, ents, fields);
    ents = LanguageHelper.consolidateFields(ents, lang);

    return _.map(ents, translateTypeEnum);
  }
}