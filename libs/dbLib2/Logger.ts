import { v4 as uuid } from 'uuid';
import { inspect } from 'util';
import config from '../../config/appConfig';

export class Logger {
  protected _id: string;
  protected _methodName: string;

  constructor (
    protected _className: string = ''
  ) {
    this._id = uuid();
  }

  public in (methodName: string): Logger {
    let o = new Logger(this._className);
    o._id = this._id;
    o._methodName = methodName;
    return o;
  }

  public log (msg: any) {
    let prefix = (this._methodName ?
      `${this._className}.${this._methodName}` :
      `${this._className}`) + `:${this._id}`;
    Logger.log(msg, prefix);
  }

  public static log (msg: any, prefix?: string) {
    if (typeof msg !== 'string') {
      let colors = config.isLocal;
      msg = inspect(msg, { depth: null, colors: colors });
    }
    if (prefix !== undefined) {
      console.log(`[${prefix}] ${msg}`);
    } else {
      console.log(msg);
    }
  }
}