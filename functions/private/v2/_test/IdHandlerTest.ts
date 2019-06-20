import 'mocha';
import * as chai from 'chai';
import { expect } from 'chai';
import * as chaiAsPromised from 'chai-as-promised';
import { IdHandler } from '../IdHandler';
import { DataGraph, IDataGraph, IEnt } from '../../../../libs/dbLib2/DataGraph';
import { Substitute, Arg, SubstituteOf } from '@fluffy-spoon/substitute';
import { RequestParams } from '../RequestParams';

describe('IdHandlerTest', function () {
  let entries: object;
  let g: SubstituteOf<IDataGraph>;

  before(function () {
    chai.use(chaiAsPromised);

    entries = {
      id0: { _id: 'id0', _type: 999 },
      id1: { _id: 'id1', _type: 999 },
      id2: { _id: 'id2', _type: 999 },
      id3: { _id: 'id3', _type: 999 },
      id4: { _id: 'id4', _type: 999 },
    };

    g = Substitute.for<IDataGraph>();
    g.loadEntity(Arg.any(), Arg.any()).mimicks(
      async (id, _fields) => entries[id]
    );
  });

  beforeEach(function () {
    //
  });

  after(function () {
    //
  });

  it('test normal', async function () {
    let params = new RequestParams({
      id: ['id1', 'id2', 'id4'],
      fields: ['field1', 'field2#f2sub1,f2sub2'],
    });
    let handler = new IdHandler(g);
    let results = await handler.run(params);
    expect(results).to.deep.equal([
      entries['id1'],
      entries['id2'],
      entries['id4'],
    ]);
  });

  it('test partial', async function () {
    let params = new RequestParams({
      id: ['id9999', 'id2', 'id4'],
      fields: ['field1', 'field2#f2sub1,f2sub2'],
    });
    let handler = new IdHandler(g);
    let results = await handler.run(params);
    expect(results).to.deep.equal([undefined, entries['id2'], entries['id4']]);
  });

  it('test empty', async function () {
    let params = new RequestParams({
      id: [],
      fields: ['field1', 'field2#f2sub1,f2sub2'],
    });
    let handler = new IdHandler(g);
    let results = await handler.run(params);
    expect(results).to.deep.equal([]);
  });
});
