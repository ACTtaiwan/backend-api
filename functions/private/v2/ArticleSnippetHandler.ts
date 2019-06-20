import * as _ from 'lodash';
import {
  Type,
  DataGraph,
  IEnt,
  IDataGraph,
} from '../../../libs/dbLib2/DataGraph';
import { RequestHandlerBase } from './RequestHandlerBase';
import { RequestParams } from './RequestParams';

type Site = 'act' | 'ustw';
function toSite (o: string): Site {
  if (o === 'act') {
    return 'act';
  }
  if (o === 'ustw') {
    return 'ustw';
  }
}

export class ArticleSnippetHandler extends RequestHandlerBase<IEnt> {
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
    let site = params.getFirstString('site');
    let before = params.getFirstInt('before');
    let limit = params.getFirstInt('limit');
    let fields = params.getFields();

    let entQuery = { _type: Type.ArticleSnippet };

    if (!toSite(site)) {
      throw Error(
        `[ArticleSnippetHandler.postProcess()] Param site invalid: ${site}`
      );
    }
    entQuery['sites'] = site;

    if (before) {
      entQuery['date'] = { _op: '<', _val: before };
    }

    return await this._g.findEntities(
      entQuery,
      undefined,
      fields,
      [{ field: 'date', order: 'desc' }],
      limit
    );
  }
}
