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
    if (typeof msg !== 'string') {
      msg = inspect(msg, { depth: null, colors: true });
    }
    let prefix = this._className ?
      `${this._className}.${this._methodName}` :
      `${this._methodName}`;
    console.log(`[${prefix}:${this._id}] ${msg}`);
  }

  public static log (msg: string, prefix?: string) {
    console.log(`[${prefix}] ${msg}`);
  }
}