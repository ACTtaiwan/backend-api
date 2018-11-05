import { v4 as uuid } from 'uuid';
import { inspect } from 'util';

export class Logger {
  protected _id: string;
  constructor (
    protected _methodName: string,
    protected _className?: string,
  ) {
    this._id = uuid();
  }

  public log (msg: any) {
    let prefix = (this._className ?
      `${this._className}.${this._methodName}` :
      `${this._methodName}`) + `:${this._id}`;
    Logger.log(msg, prefix);
  }

  public static log (msg: any, prefix?: string) {
    if (typeof msg !== 'string') {
      msg = inspect(msg, { depth: null, colors: true });
    }
    if (prefix !== undefined) {
      console.log(`[${prefix}] ${msg}`);
    } else {
      console.log(msg);
    }
  }
}