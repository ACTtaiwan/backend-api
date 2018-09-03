import 'mocha';
import { v4 as uuid } from 'uuid';
import { expect } from 'chai';
import { DataGraphUtils } from '../DataGraphUtils';
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

  it('strip underscore properties 1', function () {
    let obj = { a: 1, b: '_2', _c: 3.3, d: '4' };
    let objAfter = { a: 1, b: '_2', d: '4' };
    let result = DataGraphUtils.stripUnderscoreProps(obj);
    expect(result).to.eql(objAfter);
  });

  it('strip underscore properties 2', function () {
    let obj = { _a: 1 };
    let objAfter = {};
    let result = DataGraphUtils.stripUnderscoreProps(obj);
    expect(result).to.eql(objAfter);
  });

  it('strip underscore properties 3', function () {
    let obj = { a: 1, b: 'bbb' };
    let objAfter = { a: 1, b: 'bbb' };
    let result = DataGraphUtils.stripUnderscoreProps(obj);
    expect(result).to.eql(objAfter);
  });

  it('strip underscore properties 4', function () {
    let obj = { a: 1, _b: { _x: 5, y: 6}, _c: 3.3, d: { aa: 1, bb: 2, _cc: 3 }};
    let objAfter = { a: 1, d: { aa: 1, bb: 2, _cc: 3 }};
    let result = DataGraphUtils.stripUnderscoreProps(obj);
    expect(result).to.eql(objAfter);
  });

});