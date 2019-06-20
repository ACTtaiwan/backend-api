import * as _ from 'lodash';
import { DataGraph, IEnt, IDataGraph } from '../../../libs/dbLib2/DataGraph';
import { RequestHandlerBase } from './RequestHandlerBase';
import { RequestParams } from './RequestParams';

export class IdHandler extends RequestHandlerBase<IEnt> {
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
    let ids = params.getStrings('id');
    let fields = params.getFields();

    return await Promise.all(
      _.map(ids, async id => this._g.loadEntity(id, fields))
    );
  }
}
