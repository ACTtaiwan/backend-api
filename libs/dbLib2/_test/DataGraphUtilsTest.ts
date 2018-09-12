import 'mocha';
import { v4 as uuid } from 'uuid';
import { expect } from 'chai';
import { DataGraphUtils } from '../DataGraph';
import { Binary } from 'bson';
import * as _ from 'lodash';

describe('DataGraphUtilsTest', function () {
  let uuidStr, uuidBuf;
  beforeEach(function () {
    let data = [
      0x10, 0x91, 0x56, 0xbe, 0xc4, 0xfb, 0xc1, 0xea,
      0x71, 0xb4, 0xef, 0xe1, 0x67, 0x1c, 0x58, 0x03,
    ];
    uuidStr = uuid({ random: data });
    uuidBuf = uuid({ random: data }, Buffer.alloc(16));
  });

  it('uuid buffer to string', function () {
    let result = DataGraphUtils.idFromBuffer(uuidBuf);
    expect(result).to.eql(uuidStr);
  });

  it('uuid string to buffer', function () {
    let result = DataGraphUtils.idToBuffer(uuidStr);
    expect(result).to.eql(uuidBuf);
  });

});