import * as _ from 'lodash';
import { v4 as uuid } from 'uuid';
import { TId } from './DataGraph';

export class DataGraphUtils {
  public static idFromBuffer (idBuf: Buffer): TId {
    let strs = _.map(idBuf, byte => {
      let ret = byte.toString(16);
      if (ret.length < 2) {
        return '0' + ret;
      }
      return ret;
    });
    let i = 0;
    return strs[i++] + strs[i++] + strs[i++] + strs[i++] + '-'
      + strs[i++] + strs[i++] + '-'
      + strs[i++] + strs[i++] + '-'
      + strs[i++] + strs[i++] + '-'
      + strs[i++] + strs[i++] + strs[i++] + strs[i++] + strs[i++] + strs[i++];
  }

  public static idToBuffer (id: TId): Buffer {
    let a = _.filter(id.toLowerCase(), c =>
      (c >= '0' && c <= '9') || (c >= 'a' && c <= 'f')
    );
    if (a.length % 2 !== 0) {
      return;
    }
    let bytes = _.map(_.chunk(a, 2), b => parseInt(b[0] + b[1], 16));
    return Buffer.from(bytes);
  }

  public static stripUnderscoreProps (obj: any): any {
    return _.pickBy(obj, (_, key) => !key.startsWith('_'));
  }

}