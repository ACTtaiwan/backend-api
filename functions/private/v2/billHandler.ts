import * as _ from 'lodash';
import { Type, DataGraph } from '../../../libs/dbLib2/DataGraph';
import { translateTypeEnum } from './handlers';
import { AssocFieldResolver } from './AssocFieldResolver';
import { LanguageHelper } from './LanguageHelper';

export class BillHandler {
  public static async run (
    congresses: number[],
    sponsorIds: string[],
    cosponsorIds: string[],
    tagIds: string[],
    fields: string[],
    lang?: string,
  ): Promise<any> {

    let entQuery = { _type: Type.Bill };
    let entAssocQueries = [];
    if (congresses && congresses.length > 0) {
      entQuery['congress'] = congresses;
    }
    if (sponsorIds && sponsorIds.length > 0) {
      entAssocQueries.push({
        _type: Type.Sponsor,
        _id1: sponsorIds,
      });
    }
    if (cosponsorIds && cosponsorIds.length > 0) {
      entAssocQueries.push({
        _type: Type.Cosponsor,
        _id1: cosponsorIds,
      });
    }
    if (tagIds && tagIds.length > 0) {
      entAssocQueries.push({
        _type: Type.HasTag,
        _id2: tagIds,
      });
    }

    let g = await DataGraph.getDefault();
    fields = LanguageHelper.augmentFields(fields, lang);
    let ents = await g.findEntities(
      entQuery,
      entAssocQueries,
      fields,
      [{ field: 'introducedDate', order: 'desc'}],
    );
    ents = await AssocFieldResolver.resolve(g, ents, fields);
    ents = LanguageHelper.consolidateFields(ents, lang);

    return _.map(ents, translateTypeEnum);
  }
}