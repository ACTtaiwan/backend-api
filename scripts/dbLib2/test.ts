import * as dbLib2 from '../../libs/dbLib2';
import * as _ from 'lodash';

let m = dbLib2.TextVersionMetaHelper.getMetaMap();
console.log(_.keys(m).map(x => `'${x}'`).join(' | '));