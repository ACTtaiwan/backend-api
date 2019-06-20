import * as _ from 'lodash';
import { IFields } from '../../../libs/dbLib2';

class RequestParamValueContext {
  private _processed?: any;

  constructor (private _raw: string[] = []) {}

  public getRaw (): string[] {
    return this._raw;
  }

  public getProcessed () {
    return this._processed;
  }

  public process (processor: (raw: string[]) => any): void {
    this._processed = processor(this._raw);
  }
}

class RequestParamValues {
  private _vals: { [val: string]: RequestParamValueContext };

  constructor (raw: string[]) {
    this._vals = _.chain(raw)
      .map((val: string) => {
        let pos = val.indexOf('#');
        if (pos < 0) {
          return [val, new RequestParamValueContext()];
        } else if (pos === 0) {
          return;
        } else {
          let fieldName = val.substring(0, pos);
          let rest = val.substring(pos + 1);
          let fieldContext: string[];
          if (rest && rest.length > 0) {
            fieldContext = _.split(rest, ',');
          }
          return [fieldName, new RequestParamValueContext(fieldContext)];
        }
      })
      .fromPairs()
      .value();
  }

  public processContext (
    val: string,
    processor: (raw: string[]) => any
  ): boolean {
    let context = this._vals[val];
    if (!context || context.getProcessed() !== undefined) {
      return false;
    }
    context.process(processor);
    return true;
  }

  public getAllValues (): string[] {
    return _.keys(this._vals);
  }

  public getContext (val: string): RequestParamValueContext {
    return this._vals[val];
  }

  public add (val: string, context = new RequestParamValueContext()): boolean {
    if (this._vals[val]) {
      return false;
    }
    this._vals[val] = context;
    return true;
  }

  public remove (val: string): RequestParamValueContext {
    let ret = this._vals[val];
    if (ret) {
      delete this._vals[val];
      return ret;
    }
  }

  public contains (val: string): boolean {
    return val in this._vals;
  }
}

/**
 * Example:
 *  Raw (from query string): {
 *    param1: [ "val1", "val2#a,b", "#adsf" ],
 *    ...
 *  }
 *  RequestParams: {
 *    param1: {
 *      val1: { raw: [] },
 *      val2: { raw: ["a", "b"], processed: { what: ever} },  // value context
 *    },
 *    ...
 *  }
 */
export class RequestParams {
  private _f: { [name: string]: RequestParamValues };

  public constructor (raw: { [name: string]: string[] }) {
    this._f = _.mapValues(raw, vals => new RequestParamValues(vals));
  }

  public get (name: string): RequestParamValues {
    return this._f[name];
  }

  public getStrings (name: string): string[] {
    let values = this._f[name];
    if (!values) {
      return [];
    }
    return values.getAllValues();
  }

  public getFirstString (name: string): string {
    let vals = this.getStrings(name);
    if (vals.length >= 1) {
      return _.head(vals);
    }
  }

  public getInts (name: string): number[] {
    return _.map(this.getStrings(name), v => _.parseInt(v));
  }

  public getFirstInt (name: string): number {
    let vals = this.getStrings(name);
    if (vals.length >= 1) {
      return _.parseInt(_.head(vals));
    }
  }

  public getFields (): IFields {
    let fields: IFields = undefined;

    let fieldValues = this._f['field'];
    if (fieldValues) {
      let fieldNames = fieldValues.getAllValues();
      fields = _.chain(fieldNames)
        .map(f => {
          let context = fieldValues.getContext(f);
          return [f, context.getProcessed() || true];
        })
        .fromPairs()
        .value();
    }

    return fields;
  }
}
