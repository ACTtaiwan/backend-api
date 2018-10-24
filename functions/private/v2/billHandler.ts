import * as _ from 'lodash';
import { Type, DataGraph } from '../../../libs/dbLib2/DataGraph';
import { translateTypeEnum } from './handlers';
import { IdHandler } from './idHandler';

export class BillHandler {
  public static async run (
    congresses: number[],
    sponsors: string[],
    cosponsors: string[],
    tags: string[],
    fields: string[],
  ): Promise<any> {

    let entQuery = { _type: Type.Bill };
    let entAssocQueries = [];
    if (congresses && congresses.length > 0) {
      entQuery['congress'] = congresses;
    }
    if (sponsors && sponsors.length > 0) {
      entAssocQueries.push({
        _type: Type.Sponsor,
        _id1: sponsors,
      });
    }
    if (cosponsors && cosponsors.length > 0) {
      entAssocQueries.push({
        _type: Type.Cosponsor,
        _id1: cosponsors,
      });
    }
    if (tags && tags.length > 0) {
      entAssocQueries.push({
        _type: Type.HasTag,
        _id2: tags,
      });
    }

    let g = await DataGraph.getDefault();
    let ents = await g.findEntities(
      entQuery,
      entAssocQueries,
      fields,
      [{ field: 'introducedDate', order: 'desc'}],
    );
    ents = await IdHandler.resolveAssocFields(g, ents, fields);

    return _.map(ents, translateTypeEnum);
  }
}