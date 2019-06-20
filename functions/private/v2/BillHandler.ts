import * as _ from 'lodash';
import {
  Type,
  DataGraph,
  IEnt,
  IDataGraph,
} from '../../../libs/dbLib2/DataGraph';
import { RequestHandlerBase } from './RequestHandlerBase';
import { RequestParams } from './RequestParams';

export class BillHandler extends RequestHandlerBase<IEnt> {
  public constructor (private _g: IDataGraph) {
    super();
  }

  protected async preProcess (_params: RequestParams): Promise<boolean> {
    return true;
  }

  protected async postProcess (
    params: RequestParams,
    _r: IEnt[]
  ): Promise<IEnt[]> {
    let congresses = params.getInts('congress');
    let sponsorIds = params.getStrings('sponsorId');
    let cosponsorIds = params.getStrings('cosponsorId');
    let tagIds = params.getStrings('tagId');
    let fields = params.getFields();

    let entQuery = { _type: Type.Bill };
    let entAssocQueries = [];
    if (congresses.length > 0) {
      entQuery['congress'] = congresses;
    }
    if (sponsorIds.length > 0) {
      entAssocQueries.push({
        _type: Type.Sponsor,
        _id1: sponsorIds,
      });
    }
    if (cosponsorIds.length > 0) {
      entAssocQueries.push({
        _type: Type.Cosponsor,
        _id1: cosponsorIds,
      });
    }
    if (tagIds.length > 0) {
      entAssocQueries.push({
        _type: Type.HasTag,
        _id2: tagIds,
      });
    }

    return await this._g.findEntities(entQuery, entAssocQueries, fields, [
      { field: 'introducedDate', order: 'desc' },
    ]);
  }
}
