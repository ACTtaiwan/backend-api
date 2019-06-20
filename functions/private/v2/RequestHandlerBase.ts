import * as _ from 'lodash';
import { RequestParams } from './RequestParams';

/**
 * Decorator pattern
 * @param T Result type
 */
export abstract class RequestHandlerBase<T> {
  public constructor (private _innerHandler?: RequestHandlerBase<T>) {}

  public async run (params: RequestParams): Promise<T[]> {
    if (await this.preProcess(params)) {
      let results: T[];
      if (this._innerHandler) {
        results = await this._innerHandler.run(params);
      }
      return await this.postProcess(params, results);
    } else if (this._innerHandler) {
      return await this._innerHandler.run(params);
    } else {
      return [];
    }
  }

  /**
   * @return processed params, or undefined if params is invalid for the
   * handler, in which case the postProcess() stage will be skipped
   */
  protected async abstract preProcess (params: RequestParams): Promise<boolean>;

  protected async abstract postProcess (params: RequestParams, results: T[])
    : Promise<T[]>;
}