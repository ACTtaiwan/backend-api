import * as congressGov from '../congressGov';
import * as _ from 'lodash';
let json = require('./textVersionMeta.json');

export type TextVersionChamber = congressGov.ChamberType | 'joint';

export type TextVersionCode = 'unknown' | 'rcs' | 'res' | 'rdh' | 'ips' | 'eph' | 'enr' | 'rts' | 'cds' | 'sc' | 'ath' | 'renr' | 'reah' | 'rfs' | 'fph' | 'hds' | 'rds' | 'cdh' | 'pl' | 'cph' | 'as' | 'eh' | 'rs' | 'cps' | 'ris' | 'lth' | 'ash' | 'rih' | 'sas' | 'is' | 'hdh' | 'pp' | 'pav' | 'rch' | 'rfh' | 'eah' | 'lts' | 'pwh' | 'es' | 'fah' | 'ops' | 'rh' | 'pcs' | 'ats' | 'iph' | 'rah' | 'pap' | 'ras' | 'fps' | 'ih' | 'rth' | 'eas' | 'oph' | 'pch';

export interface TextVersionMeta {
  chamber: TextVersionChamber[];
  code: TextVersionCode;
  name: string;
  description: string;
}

export type TextVersionMapByCode = { [code in TextVersionCode]: TextVersionMeta };

export class TextVersionMetaHelper {
  public static readonly m = <TextVersionMapByCode> _.keyBy(json, 'code');

  private constructor () {
  }

  public static getAll (): TextVersionMeta[] {
    return json;
  }

  public static getMetaMap (): TextVersionMapByCode {
    return TextVersionMetaHelper.m;
  }

  public static getMetaByCode (code: string | TextVersionCode): TextVersionMeta {
    return TextVersionMetaHelper.m[code];
  }
}

export function isTextVersionCode (code: string): code is TextVersionCode {
  return !!TextVersionMetaHelper.getMetaByCode(code);
}
