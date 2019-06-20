import * as _ from 'lodash';
import {
  Type,
  DataGraph,
  IEnt,
  IDataGraph,
} from '../../../libs/dbLib2/DataGraph';
import { CongressUtils } from '../../../libs/dbLib2/CongressUtils';
import { RequestHandlerBase } from './RequestHandlerBase';
import { RequestParams } from './RequestParams';

export class PersonHandler extends RequestHandlerBase<IEnt> {
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
    let states = params.getStrings('state');
    let districts = params.getInts('district');
    let chamber = params.getStrings('chamber');
    let billIds = params.getStrings('billId');
    let fields = params.getFields();

    let nestedQuery = {};
    if (congresses && congresses.length > 0) {
      nestedQuery['congressNumbers'] = congresses;
    }
    states = _.filter(
      _.map(params.getStrings('state'), CongressUtils.validateState)
    );
    if (states.length > 0) {
      nestedQuery['state'] = states;
    }
    if (districts && districts.length > 0) {
      nestedQuery['district'] = districts;
    }
    if (chamber && chamber.length > 0) {
      nestedQuery['chamber'] = chamber;
    }

    let entQuery = { _type: Type.Person };
    if (nestedQuery !== {}) {
      entQuery['congressRoles'] = {
        _op: 'has_any',
        _val: nestedQuery,
      };
    }

    let entAssocQueries = [];
    if (billIds.length > 0) {
      entAssocQueries.push({
        _type: [Type.Sponsor, Type.Cosponsor],
        _id2: billIds,
      });
    }

    return await this._g.findEntities(entQuery, entAssocQueries, fields, [
      { field: 'lastName', order: 'asc' },
      { field: 'firstName', order: 'asc' },
      { field: 'middleName', order: 'asc' },
    ]);
  }
}
