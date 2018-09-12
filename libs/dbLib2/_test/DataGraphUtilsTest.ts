import 'mocha';
import { v4 as uuid } from 'uuid';
import * as chai from 'chai';
import { expect } from 'chai';
import * as chaiAsPromised from 'chai-as-promised';
import { DataGraphUtils } from '../DataGraph';
import * as _ from 'lodash';

describe('DataGraphUtilsTest', function () {
  let uuidStr, uuidBuf;

  before(function () {
    chai.use(chaiAsPromised);
  });

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

  it('run func succeeds the first time', async function () {
    let func = async (): Promise<string> => {
      return 'something';
    }
    let result = await DataGraphUtils.retry(func);
    expect(result).to.be.equal('something');
  });

  it('retry func and evantually failed', async function () {
    let func = async (): Promise<string> => {
      throw Error('this is an error');
    }
    expect(DataGraphUtils.retry(func)).to.be.rejected;
  });

  it('retry func succeeds the second time', async function () {
    let counter = 0;
    let func = async (): Promise<string> => {
      if (counter++ < 2) {
        throw Error('this is an error');
      }
      return 'success';
    }
    expect(DataGraphUtils.retry(func)).to.eventually.be.equal('success');
  });

});