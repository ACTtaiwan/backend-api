import * as _ from 'lodash';
import { DataGraph, Id } from '../../../libs/dbLib2/DataGraph';
import { translateTypeEnum } from './handlers';
import { AssocFieldResolver } from './AssocFieldResolver';
import { LanguageHelper } from './LanguageHelper';
import { CongressRoleFilter } from './CongressRoleFilter';
import { ArrayFieldFilters } from '../../../libs/dbLib2';

export class IdHandler {
  public static async run (
    ids: Id[],
    fields: string[],
    lang?: string,
  ): Promise<any> {
    let g = await DataGraph.getDefault();

    fields = LanguageHelper.augmentFields(fields, lang);

    let fieldFilters: ArrayFieldFilters = {};
    fields = CongressRoleFilter.getFieldFilters(fields, fieldFilters);

    let ents = await Promise.all(
      _.map(ids, async id => g.loadEntity(
        id,
        _.isEmpty(fields) ? undefined : fields,
        fieldFilters,
      )),
    );
    ents = await AssocFieldResolver.resolve(g, ents, fields);
    ents = LanguageHelper.consolidateFields(ents, lang);

    return _.map(ents, translateTypeEnum);
  }

}