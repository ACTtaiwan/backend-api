import * as _ from 'lodash';
import { expect } from 'chai';
import 'mocha';
import { IDataGraph, DataGraph, Type } from '../DataGraph';
import { MongoGraph } from '../MongoGraph';

describe('MongoGraphTest', async function () {
  let g: IDataGraph;

  const ENT_TYPE1 = Type.TestEntType1;
  const ENT_TYPE2 = Type.TestEntType2;
  const ASSOC_TYPE1 = Type.TestAssocType1;
  const ASSOC_TYPE2 = Type.TestAssocType2;
  let data = [
    { _type: ENT_TYPE1, a: 1, b: 'bbb', c: false },
    { _type: ENT_TYPE1, a: 999, c: Date.now()},
    { _type: ENT_TYPE1, a: 1, b: 'zzz' },
    { _type: ENT_TYPE1, a: 2, b: 'bbb' },
    { _type: ENT_TYPE2, x: 'xxx', z: [
      { speed: 123, name: 'fdaa' },
      { speed: 3, name: 'xlufal' },
      { speed: 56, year: 2005 },
      { speed: 300 },
      'what?',
      { struct: { p: -56, q: 56 } },
      { year: [1994, 2000, 2005, 2010, 2020] },
    ] },
    { _type: ENT_TYPE2, y: 'yyy' },
  ];
  let assocData = [
    { type: ASSOC_TYPE2, entInd1: 0, entInd2: 1 },
    { type: ASSOC_TYPE2, entInd1: 0, entInd2: 3 },
    { type: ASSOC_TYPE2, entInd1: 2, entInd2: 2 },
    { type: ASSOC_TYPE2, entInd1: 2, entInd2: 3 },
    { type: ASSOC_TYPE2, entInd1: 3, entInd2: 0 },
    { type: ASSOC_TYPE2, entInd1: 3, entInd2: 3 },
    { type: ASSOC_TYPE1, entInd1: 4, entInd2: 0, d: { d: 'data1' } },
    { type: ASSOC_TYPE1, entInd1: 5, entInd2: 0 },
    { type: ASSOC_TYPE1, entInd1: 5, entInd2: 1,
      d: { d: 'data2', e: 56.56 }
    },
  ];

  before(async function () {
    g = await DataGraph.get(
      'MongoGraph',
      'test_mongograph',
      'test_entities',
      'test_assocs',
      'mongodb://localhost:27017',
    );
    if (!g) {
      this.skip();
    }
  });

  after(async function () {
    if (g) {
      g.close();
    }
  });

  async function dropDb () {
    if (g) {
      await g.dropDb();
    }
  }

  async function insertTestEntData () {
    return await g.insertEntities(data);
  }

  async function insertTestAssocData (entIds) {
    let assocInserts = _.map(assocData, d => {
      let assocInsert = {
        _type: d.type,
        _id1: entIds[d.entInd1],
        _id2: entIds[d.entInd2],
      };
      return _.merge(assocInsert, d.d);
    });
    return await g.insertAssocs(assocInserts);
  }

  async function loadAllEnts (ids) {
    return await Promise.all(_.map(ids, id => g.loadEntity(id)));
  }

  async function loadAllAssocs (assocIds) {
    return await Promise.all(_.map(assocIds, id => g.loadAssoc(id)));
  }

  function mockAllAssocs (ids, assocIds) {
    return _.map(assocData, (d, i) =>
      _.merge({
        _id: assocIds[i],
        _type: d.type,
        _id1: ids[d.entInd1],
        _id2: ids[d.entInd2],
      }, d.d)
    );
  }

  describe('Insert', async function () {
    before(function () {
      if (!g) {
        this.skip();
      }
    });

    beforeEach(dropDb);

    after(dropDb);

    it('insert ents', async function () {
      let ids = await insertTestEntData();
      expect(ids).to.have.lengthOf(6);
      expect(ids).to.not.include(undefined);
    });

    it('insert assocs', async function () {
      let ids = await insertTestEntData();
      let assocIds = await insertTestAssocData(ids);
      expect(assocIds).to.have.lengthOf(9);
      expect(assocIds).to.not.include(undefined);
    });
  });

  describe('Load', async function () {
    let ids, assocIds;

    before(async function () {
      if (!g) {
        this.skip();
      }
      dropDb();
      ids = await insertTestEntData();
      assocIds = await insertTestAssocData(ids);
    });

    after(dropDb);

    it('load all ents', async function () {
      let ents = await loadAllEnts(ids);
      _.each(ents, (ent, i) => {
        expect(ent).to.deep.include(data[i]);
      });
    });

    it('load ent, specifying fields', async function () {
      let ent0 = await g.loadEntity(ids[0], { b: true, c: true });
      expect(ent0).to.deep.include(_.pick(data[0], ['b', 'c']));
      expect(ent0).to.not.have.any.keys(['a']);
    });

    it('load nonexisting ent', async function () {
      let ent0 =
        await g.loadEntity('d065cee5-f2cf-4728-b6c4-1fda1698517b', { b: true });
      expect(ent0).to.not.be.ok;
    });

    it('load all assocs', async function () {
      let assocs = await loadAllAssocs(assocIds);
      let mockAssocs = mockAllAssocs(ids, assocIds);
      _.each(assocs, (assoc, i) => {
        expect(assoc).to.deep.include(mockAssocs[i]);
      });
    });
  });

  describe('Find', async function () {
    let ids, assocIds, ents;

    before(async function () {
      if (!g) {
        this.skip();
      }
      dropDb();
      ids = await insertTestEntData();
      [assocIds, ents] = await Promise.all([
        insertTestAssocData(ids),
        loadAllEnts(ids),
      ]);
    });

    // after(dropDb);

    it('find ents by type', async function () {
      let found = await g.findEntities({ _type: ENT_TYPE2 });
      expect(found).to.have.lengthOf(2);
      expect(found).to.deep.include(ents[4]);
      expect(found).to.deep.include(ents[5]);
    });

    it('find ents by field value', async function () {
      let found = await g.findEntities(<any> { _type: ENT_TYPE1, a: 1 });
      expect(found).to.have.lengthOf(2);
      expect(found).to.deep.include(ents[0]);
      expect(found).to.deep.include(ents[2]);
    });

    it('find ents, specifying returned fields', async function () {
      let found =
        await g.findEntities(
          <any> { _type: ENT_TYPE1, a: 999 },
          undefined,
          { c: true },
        );
      expect(found).to.have.lengthOf(1);
      expect(found).to.deep.include(_.pick(ents[1], [ '_id', '_type', 'c' ]));
      expect(found[0]).to.not.have.any.keys([ 'a', 'b' ]);
    });

    it('find ents by field values', async function () {
      let found = await g.findEntities(<any> { _type: ENT_TYPE1, a: [1, 2] });
      expect(found).to.have.lengthOf(3);
      expect(found).to.deep.include(ents[0]);
      expect(found).to.deep.include(ents[2]);
      expect(found).to.deep.include(ents[3]);
    });

    it('find ents by multi-field, multi-values', async function () {
      let found =
        await g.findEntities(<any> { _type: ENT_TYPE1, a: [1, 2], b: 'bbb' });
      expect(found).to.have.lengthOf(2);
      expect(found).to.deep.include(ents[0]);
      expect(found).to.deep.include(ents[3]);
    });

    it('find nonexisting ents', async function () {
      let found = await g.findEntities(<any> { _type: ENT_TYPE2, d: 'data2' });
      expect(found).to.have.lengthOf(0);
    });

    it('find ents by associated ent ids 0', async function () {
      let found = await g.findEntities(
        { _type: ENT_TYPE1 },
        [{ _type: ASSOC_TYPE2, _id2: ids[2] }],
      );
      expect(found).to.have.lengthOf(1);
      expect(found).to.deep.include(ents[2]);
    });

    it('find ents by associated ent ids 1', async function () {
      let found = await g.findEntities(
        { _type: ENT_TYPE1 },
        [{ _type: ASSOC_TYPE2, _id2: [ids[2], ids[1]] }],
      );
      expect(found).to.have.lengthOf(2);
      expect(found).to.deep.include(ents[0]);
      expect(found).to.deep.include(ents[2]);
    });

    it('find ents by associated ent ids 2', async function () {
      // find ents that:
      // 1. are of type ENT_TYPE1
      // 2. have property { a: 999 }
      // 3. have an assoc with ids[5] (as id1), where the assoc:
      //  3a. of type ASSOC_TYPE1
      //  3b. has property { d: 'data2' }
      // finally, return only property c (and _id) of such ents
      let found = await g.findEntities(
        <any> { _type: ENT_TYPE1, a: 999 },
        <any> [{ _type: ASSOC_TYPE1, _id1: ids[5], d: 'data2' }],
        { c: true },
      );
      expect(found).to.have.lengthOf(1);
      expect(found).to.deep.include(_.pick(ents[1], ['_id', '_type', 'c']));
      expect(found[0]).to.not.have.any.keys(['a', 'b']);
    });

    it('find nonexisting ents by associated ent ids', async function () {
      let found = await g.findEntities(
        { _type: ENT_TYPE1 },
        [{ _type: ASSOC_TYPE2, _id1: [ids[4], ids[5]] }],
      );
      expect(found).to.have.lengthOf(0);
    });

    it('find assocs by type', async function () {
      let assocs = await loadAllAssocs(assocIds);
      let assocsFound = await g.findAssocs({ _type: ASSOC_TYPE1 });
      expect(assocsFound).to.have.lengthOf(3);
      _.each(_.slice(assocs, 6), assoc => {
        expect(assocsFound).to.deep.include(assoc);
      });
    });

    it('find assocs by id2', async function () {
      let assocs = await loadAllAssocs(assocIds);
      let assocsFound = await g.findAssocs({
        _type: ASSOC_TYPE2,
        _id2: ids[0],
      });
      expect(assocsFound).to.have.lengthOf(1);
      expect(assocsFound).to.deep.include(assocs[4]);
    });

    it('find associated ent ids, forward', async function () {
      let idsFound =
        await g.listAssociatedEntityIds(ids[2], ASSOC_TYPE2, 'forward');
      expect(idsFound).to.have.lengthOf(2);
      expect(idsFound).to.deep.include({ _id: ids[2] });
      expect(idsFound).to.deep.include({ _id: ids[3] });
    });

    it('find associated ent ids, with assoc fields', async function () {
      let idsFound =
        await g.listAssociatedEntityIds(
          ids[4],
          ASSOC_TYPE1,
          'forward',
          { d: true },
        );
      expect(idsFound).to.have.lengthOf(1);
      console.log(idsFound);
      expect(idsFound).to.deep.include({ _id: ids[0], d: 'data1' });
    });

    it('find associated ent ids, backward', async function () {
      let idsFound =
        await g.listAssociatedEntityIds(ids[1], ASSOC_TYPE2, 'backward');
      expect(idsFound).to.have.lengthOf(1);
      expect(idsFound).to.deep.include({ _id: ids[0] });
    });

    it('find associated ent ids, backward, nonexisting', async function () {
      let idsFound =
        await g.listAssociatedEntityIds(ids[3], ASSOC_TYPE1, 'backward');
      expect(idsFound).to.have.lengthOf(0);
    });
  });

  describe('Project', async function () {
    let ids, assocIds, ents;

    before(async function () {
      if (!g) {
        this.skip();
      }
      dropDb();
      ids = await insertTestEntData();
      [assocIds, ents] = await Promise.all([
        insertTestAssocData(ids),
        loadAllEnts(ids),
      ]);
    });

    it('project', async function () {
      let found = await g.findEntities(
        <any>{ _type: ENT_TYPE1 },
        undefined,
        { b: true },
      );
      expect(found).to.have.lengthOf(4);

      let fieldFilter = k => k === '_id' || k === '_type' || k === 'b';
      expect(found).to.deep.include(
        _.pickBy(ents[0], (_v, k) => fieldFilter(k))
      );
      expect(found).to.deep.include(
        _.pickBy(ents[1], (_v, k) => fieldFilter(k))
      );
      expect(found).to.deep.include(
        _.pickBy(ents[2], (_v, k) => fieldFilter(k))
      );
      expect(found).to.deep.include(
        _.pickBy(ents[3], (_v, k) => fieldFilter(k))
      );
    });

    it('filter array field, match value', async function () {
      let found = await g.findEntities(
        <any>{ _type: ENT_TYPE2, x: 'xxx' },
        undefined,
        { z: { name: 'fdaa' } },
      );
      expect(found).to.have.lengthOf(1);
      expect(found[0]['z']).to.eql([ents[4]['z'][0]]);
    });

    it('filter array field, match object value', async function () {
      let found = await g.findEntities(
        <any>{ _type: ENT_TYPE2, x: 'xxx' },
        undefined,
        { z: { struct: { p: -56, q: 56 } } },
      );
      expect(found).to.have.lengthOf(1);
      expect(found[0]['z']).to.eql([ents[4]['z'][5]]);
    });

    it('filter array field, match value in array', async function () {
      let found = await g.findEntities(
        <any>{ _type: ENT_TYPE2, x: 'xxx' },
        undefined,
        { z: { year: 2005 } },
      );
      expect(found).to.have.lengthOf(1);
      expect(found[0]['z']).to.eql([ents[4]['z'][2], ents[4]['z'][6]]);
    });

    it('filter array field, value in range', async function () {
      let found = await g.findEntities(
        <any>{ _type: ENT_TYPE2, x: 'xxx' },
        undefined,
        {
          z: {
            speed: {
              _op: 'and',
              _val: [
                { _op: '>=', _val: 3 },
                { _op: '<', _val: 100 },
              ],
            }
          },
        },
      );
      expect(found).to.have.lengthOf(1);
      expect(found[0]['z']).to.eql([ents[4]['z'][1], ents[4]['z'][2]]);
    });

    it('filter array field, value in range (load ent)', async function () {
      let found = await g.loadEntity(
        ents[4]._id,
        {
          z: {
            speed: {
              _op: 'and',
              _val: [
                { _op: '>=', _val: 3 },
                { _op: '<', _val: 100 },
              ],
            }
          },
        },
      );
      expect(found['_id']).to.eql(ents[4]['_id']);
      expect(found['z']).to.eql([ents[4]['z'][1], ents[4]['z'][2]]);
    });

    it('filter array field, specify one array index', async function () {
      let found = await g.findEntities(
        <any>{ _type: ENT_TYPE2, x: 'xxx' },
        undefined,
        { z: [0] }
      );
      expect(found).to.have.lengthOf(1);
      expect(found[0]['z']).to.eql([ents[4]['z'][0]]);
    });

    it('filter array field, specify multiple array indices', async function () {
      let found = await g.findEntities(
        <any>{ _type: ENT_TYPE2, x: 'xxx' },
        undefined,
        { z: [0, -1, 4] }
      );
      expect(found).to.have.lengthOf(1);
      expect(found[0]['z']).to.eql([
        ents[4]['z'][0],
        ents[4]['z'][6],
        ents[4]['z'][4],
      ]);
    });

  });

  describe('Update', function () {
    let ids, assocIds, ents;

    before(function () {
      if (!g) {
        this.skip();
      }
    });

    beforeEach(async function () {
      dropDb();
      ids = await insertTestEntData();
      ents = await loadAllEnts(ids);
      [assocIds, ents] = await Promise.all([
        insertTestAssocData(ids),
        loadAllEnts(ids),
      ]);
    });

    after(dropDb);

    it('update multiple ents', async function () {
      let updates = _.map(ids, (id, i) => ({ _id: id, up: i }));
      let numUpdated = await g.updateEntities(updates);
      expect(numUpdated).to.eql(updates.length);
      let updatedEnts = await Promise.all(
        _.map(ids, async id => await g.loadEntity(id)),
      );
      _.each(updatedEnts, (ent, i) => {
        expect(ent).to.deep.include(ents[i]);
        expect(ent).to.deep.include({ up: i });
      });
    });

    it('update a single ent, remove/add a field', async function () {
      let numUpdated = await g.updateEntities([
        <any> { _id: ids[1], up: undefined, z: '78' }, // remove up, add z
      ]);
      expect(numUpdated).to.eql(1);
      let updatedEnt = await g.loadEntity(ids[1]);
      expect(updatedEnt).to.eql(_.merge(ents[1], { z: '78' }));
    });

    it('update assocs', async function () {
      let assocs = await loadAllAssocs(assocIds);
      let updates = [
        { _id: assocIds[0], u: '123'},  // new field
        { _id: assocIds[6], d: undefined },  // delete
        { _id: assocIds[8], e: '5566'}, // overwrite
      ];
      let numUpdated = await g.updateAssocs(updates);
      expect(numUpdated).to.eql(updates.length);
      let updated = await Promise.all(
        _.map(assocIds, async id => await g.loadAssoc(id)),
      );
      _.each(updated, (assoc, i) => {
        if (i === 0) {
          expect(assoc).to.eql(_.merge(assocs[i], { u: '123' }));
        } else if (i === 6) {
          let a = _.cloneDeep(assocs[i]);
          delete (<any> a).d;
          expect(assoc).to.eql(a);
        } else if (i === 8) {
          expect(assoc).to.eql(_.merge(assocs[i], { e: '5566' }));
        } else {
          expect(assoc).to.eql(assocs[i]);
        }
      });
    });

  });

  describe('Delete', function () {
    let ids, assocIds, ents;

    before(function () {
      if (!g) {
        this.skip();
      }
    });

    beforeEach(async function () {
      dropDb();
      ids = await insertTestEntData();
      [assocIds, ents] = await Promise.all([
        insertTestAssocData(ids),
        loadAllEnts(ids),
      ]);
    });

    after(dropDb);

    it('delete assocs', async function () {
      let assocs = await loadAllAssocs(assocIds);
      let numDeleted = await g.deleteAssocs([assocIds[6], assocIds[7]]);
      expect(numDeleted).to.eql(2);
      let found = await g.findAssocs({ _type: ASSOC_TYPE1 });
      expect(found).to.have.lengthOf(1);
      expect(found).to.deep.include(assocs[8]);
      found = await g.findAssocs({ _type: ASSOC_TYPE2 });
      expect(found).to.have.lengthOf(6);
      _.each(_.slice(assocs, 0, 6), assoc => {
        expect(found).to.deep.include(assoc);
      });
    });

    it('delete ents 1', async function () {
      let assocs = await loadAllAssocs(assocIds);
      let [entsDeleted, assocsDeleted] = await g.deleteEntities([ids[0]]);
      expect(entsDeleted).to.eql(1);
      expect(assocsDeleted).to.eql(5);
      let loadedEnts = await Promise.all(
        _.map(ids, async id => await g.loadEntity(id)),
      );
      _.each(ents, (ent, i: number) => {
        if (i === 0) {
          expect(loadedEnts[i]).to.be.null;
        } else {
          expect(loadedEnts[i]).to.eql(ent);
        }
      });
      let assocsFound = await g.findAssocs({ _type: ASSOC_TYPE2 });
      expect(assocsFound).to.have.lengthOf(3);
      expect(assocsFound).to.deep.include(assocs[2]);
      expect(assocsFound).to.deep.include(assocs[3]);
      expect(assocsFound).to.deep.include(assocs[5]);
      assocsFound = await g.findAssocs({ _type: ASSOC_TYPE1 });
      expect(assocsFound).to.have.lengthOf(1);
      expect(assocsFound[0]).to.eql(assocs[8]);
    });

    it('delete ents 2 (multi)', async function () {
      let assocs = await loadAllAssocs(assocIds);
      let [entsDeleted, assocsDeleted] =
        await g.deleteEntities([ids[0], ids[2], ids[5]]);
      expect(entsDeleted).to.eql(3);
      expect(assocsDeleted).to.eql(8);
      let loadedEnts = await Promise.all(
        _.map(ids, async id => await g.loadEntity(id)),
      );
      _.each(ents, (ent, i: number) => {
        if (i === 0 || i === 2 || i === 5) {
          expect(loadedEnts[i]).to.be.null;
        } else {
          expect(loadedEnts[i]).to.eql(ent);
        }
      });
      let assocsFound = await g.findAssocs({ _type: ASSOC_TYPE2 });
      expect(assocsFound).to.have.lengthOf(1);
      expect(assocsFound).to.deep.include(assocs[5]);
      assocsFound = await g.findAssocs({ _type: ASSOC_TYPE1 });
      expect(assocsFound).to.have.lengthOf(0);
    });
  });

  describe('(Internal) _queryToExpression', function () {
    const VAR = '$$item';
    let tests = {
      'empty': { input: null, expected: {} },
      'simple': { input: 7788, expected: {
        $cond: [
          { $isArray: [VAR] },
          { $in: [7788, VAR] },
          { $eq: [7788, VAR] },
        ],
      }},
      'empty object': { input: {}, expected: {} },
      'values1': {
        input: { a: 'asdf' },
        expected: {
          $cond: [
            { $isArray: [`${VAR}.a`] },
            { $in: ['asdf', `${VAR}.a`] },
            { $eq: ['asdf', `${VAR}.a`] },
          ],
      }},
      'values2': {
        input: { a: 1, b: 'kkk' },
        expected: {
          $and: [
            { $cond: [
              { $isArray: [`${VAR}.a`] },
              { $in: [1, `${VAR}.a`] },
              { $eq: [1, `${VAR}.a`] },
            ]},
            { $cond: [
              { $isArray: [`${VAR}.b`] },
              { $in: ['kkk', `${VAR}.b`] },
              { $eq: ['kkk', `${VAR}.b`] },
            ]},
          ],
        },
      },
      'values3': {
        input: { a: 1, z: [38, 42, 'zzZ'], b: 'kkk' },
        expected: {
          $and: [
            { $cond: [
              { $isArray: [`${VAR}.a`] },
              { $in: [1, `${VAR}.a`] },
              { $eq: [1, `${VAR}.a`] }
            ]},
            { $in: [`${VAR}.z`, [38, 42, 'zzZ']] },
            { $cond: [
              { $isArray: [`${VAR}.b`] },
              { $in: ['kkk', `${VAR}.b`] },
              { $eq: ['kkk', `${VAR}.b`] },
            ]},
          ],
        },
      },
      'op1': {
        input: { y: { _op: '>', _val: 101 } },
        expected: { $gt: [`${VAR}.y`, 101]},
      },
      'op2': {
        input: {
          y: { _op: '>', _val: 101 },
          Y: { _op: '<=', _val: 9 },
        },
        expected: {
          $and: [
            { $gt: [`${VAR}.y`, 101] },
            { $lte: [`${VAR}.Y`, 9] },
          ],
        },
      },
      'op and2': {
        input: {
          y: {
            _op: 'and',
            _val: [
              { _op: '>=', _val: 2000 },
              { _op: '<', _val: 2020 },
            ],
          },
        },
        expected: {
          $and: [
            { $gte: [`${VAR}.y`, 2000] },
            { $lt: [`${VAR}.y`, 2020] },
          ],
        },
      },
      'op or4': {
        input: {
          y: {
            _op: 'or',
            _val: [
              { _op: '>=', _val: 2000 },
              { _op: '<', _val: 2020 },
              { aa: 4123, $or: 'hello' }, // $or here is not an operator
              5566,
            ],
          },
        },
        expected: {
          $or: [
            { $gte: [`${VAR}.y`, 2000] },
            { $lt: [`${VAR}.y`, 2020] },
            { $cond: [
              { $isArray: [`${VAR}.y`] },
              { $in: [{ aa: 4123, $or: 'hello' }, `${VAR}.y`] },
              { $eq: [{ aa: 4123, $or: 'hello' }, `${VAR}.y`] },
            ]},
            { $cond: [
              { $isArray: [`${VAR}.y`] },
              { $in: [5566, `${VAR}.y`] },
              { $eq: [5566, `${VAR}.y`] },
            ]},
          ],
        },
      },
      'op or and': {
        input: {
          'y.z': {
            _op: 'or',
            _val: [
              {
                _op: 'and',
                _val: [
                  { _op: '>=', _val: 2000 },
                  { _op: '<', _val: 2020 },
                ],
              },
              'haha',
            ],
          },
        },
        expected: {
          $or: [
            {
              $and: [
                { $gte: [`${VAR}.y.z`, 2000] },
                { $lt: [`${VAR}.y.z`, 2020] },
              ],
            },
            { $cond: [
              { $isArray: [`${VAR}.y.z`] },
              { $in: ['haha', `${VAR}.y.z`] },
              { $eq: ['haha', `${VAR}.y.z`] },
            ]},
          ],
        },
      },
    };

    _.forOwn(tests, (t, name) => {
      it(name, function () {
        let ret = MongoGraph['_composeExpression'](t.input, VAR);
        expect(ret).to.eql(t.expected);
      });
    });

  });
});
