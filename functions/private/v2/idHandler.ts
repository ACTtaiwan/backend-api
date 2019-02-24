import * as _ from 'lodash';
import { DataGraph, Id } from '../../../libs/dbLib2/DataGraph';
import { translateTypeEnum } from './handlers';
import { AssocFieldResolver } from './AssocFieldResolver';

export class IdHandler {
  public static async run (
    ids: Id[],
    fields: string[],
  ): Promise<any> {
    let g = await DataGraph.getDefault();
    let ents = await Promise.all(
      _.map(ids, async id => g.loadEntity(id, _.isEmpty(fields) ? undefined : fields))
    );
    ents = await AssocFieldResolver.resolve(g, ents, fields);

    return _.map(ents, translateTypeEnum);
  }

}