import * as _ from 'lodash';
import { Type, DataGraph } from '../../../libs/dbLib2/DataGraph';
import { translateTypeEnum, Site, Timestamp } from './handlers';

export class ArticleSnippetHandler {
  public static async run (
    site: Site,
    before: Timestamp, // timestamp
    limit: number,
    fields: string[],
  ): Promise<any> {
    let entQuery = { _type: Type.ArticleSnippet };

    if (!site) {
      throw Error('Param site not provided');
    }
    entQuery['sites'] = site;

    if (before) {
      entQuery['date'] = { _op: '<', _val: before };
    }

    let g = await DataGraph.getDefault();
    let ents = await g.findEntities(
      entQuery,
      undefined,
      fields,
      [{ field: 'date', order: 'desc' }],
      limit,
    );

    return _.map(ents, translateTypeEnum);
  }
}