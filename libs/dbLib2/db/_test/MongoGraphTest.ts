import * as _ from 'lodash';
import { expect } from 'chai';
import 'mocha';
import { IDataGraph, DataGraph } from '../DataGraph';

describe('MongoGraphTest', async function () {
  let g: IDataGraph;

  const ENT_TYPE1 = 'test_type1';
  const ENT_TYPE2 = 'test_type2';
  const ASSOC_TYPE1 = 'test_type3';
  const ASSOC_TYPE2 = 'test_type4';
  let data = [
    { a: 1, b: 'bbb', c: false },
    { a: 999, c: Date.now()},
    { a: 1, b: 'zzz' },
    { a: 2, b: 'bbb' },
    { x: 'xxx' },
    { y: 'yyy' },
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
    g = await DataGraph.create(
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
      await g.dropDb();
      g.close();
    }
  });

  async function dropDb () {
    if (g) {
      await g.dropDb();
    }
  }

  async function insertTestEntData () {
    let ids1 = await g.insertEntities(ENT_TYPE1, _.slice(data, 0, 4));
    let ids2 = await g.insertEntities(ENT_TYPE2, _.slice(data, 4));
    return _.concat(ids1, ids2);
  }

  async function insertTestAssocData (entIds) {
    return await Promise.all(_.map(assocData, async d => {
      if (d.d) {
        return g.insertAssoc(d.type, entIds[d.entInd1], entIds[d.entInd2], d.d);
      } else {
        return g.insertAssoc(d.type, entIds[d.entInd1], entIds[d.entInd2]);
      }
    }));
  }

  async function loadAllEnts (ids) {
    return await Promise.all(_.map(ids, id => g.loadEntity(id)));
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

    afterEach(dropDb);

    it('#insert ents', async function () {
      let ids = await insertTestEntData();
      expect(ids).to.have.lengthOf(6);
      expect(ids).to.not.include(undefined);
    });

    it('#insert assocs', async function () {
      let ids = await insertTestEntData();
      let assocIds = await insertTestAssocData(ids);
      expect(assocIds).to.have.lengthOf(9);
      expect(assocIds).to.not.include(undefined);
    });
  });

  describe('Load', async function () {
    let ids;

    before(async function () {
      if (!g) {
        this.skip();
      }
      ids = await insertTestEntData();
    });

    after(dropDb);

    it('#load all ents', async function () {
      let ents = await loadAllEnts(ids);
      _.each(ents, (ent, i) => {
        expect(ent).to.deep.include(data[i]);
      });
    });

    it('#load ent, specifying fields', async function () {
      let ent0 = await g.loadEntity(ids[0], ['b', 'c']);
      expect(ent0).to.deep.include(_.pick(data[0], ['b', 'c']));
    });

    it('#load nonexisting ent', async function () {
      let ent0 =
        await g.loadEntity('d065cee5-f2cf-4728-b6c4-1fda1698517b', ['b']);
      expect(ent0).to.be.undefined;
    });
  });

  describe('Find', async function () {
    let ids, assocIds, ents;

    before(async function () {
      if (!g) {
        this.skip();
      }
      ids = await insertTestEntData();
      [assocIds, ents] = await Promise.all([
        insertTestAssocData(ids),
        loadAllEnts(ids),
      ]);
    });

    after(dropDb);

    it('#find ents by type', async function () {
      let found = await g.findEntities(ENT_TYPE2);
      expect(found).to.have.lengthOf(2);
      expect(found).to.deep.include(ents[4]);
      expect(found).to.deep.include(ents[5]);
    });

    it('#find ents by field value', async function () {
      let found = await g.findEntities(ENT_TYPE1, { a: 1 });
      expect(found).to.have.lengthOf(2);
      expect(found).to.deep.include(ents[0]);
      expect(found).to.deep.include(ents[2]);
    });

    it('#find ents, specifying returned fields', async function () {
      let found =
        await g.findEntities('test_ent_type1', { a: 999 }, undefined, ['c']);
      expect(found).to.have.lengthOf(1);
      expect(found).to.deep.include(_.pick(ents[1], ['_id', 'c']));
      expect(found[0]).to.not.have.any.keys(['a', 'b']);
    });

    it('#find ents by field values', async function () {
      let found = await g.findEntities(ENT_TYPE1, { a: [1, 2] });
      expect(found).to.have.lengthOf(3);
      expect(found).to.deep.include(ents[0]);
      expect(found).to.deep.include(ents[2]);
      expect(found).to.deep.include(ents[3]);
    });

    it('#find ents by multi-field, multi-values', async function () {
      let found = await g.findEntities(ENT_TYPE1, { a: [1, 2], b: 'bbb' });
      expect(found).to.have.lengthOf(2);
      expect(found).to.deep.include(ents[0]);
      expect(found).to.deep.include(ents[3]);
    });

    it('#find nonexisting ents', async function () {
      let found = await g.findEntities(ENT_TYPE2, { d: 'data2' });
      expect(found).to.have.lengthOf(0);
    });

    it('#find ents by associated ent ids', async function () {
      let found = await g.findEntities(
        ENT_TYPE1,
        undefined,
        { type: ASSOC_TYPE2, id2: [ids[2], ids[1]] },
      );
      expect(found).to.have.lengthOf(2);
      expect(found).to.deep.include(ents[0]);
      expect(found).to.deep.include(ents[2]);
    });

    it('#find ents by associated ent ids 2', async function () {
      // find ents based on associated ent ids, specifying assoc data and fields
      // to return
      let found = await g.findEntities(
        ENT_TYPE1,
        { a: 999 },
        { _type: ASSOC_TYPE1, _id1: ids[5], d: 'data2' },
        ['c'],
      );
      expect(found).to.have.lengthOf(1);
      expect(found).to.deep.include(_.pick(ents[1], ['c']));
      expect(found[0]).to.not.have.any.keys(['a', 'b']);
    });

    it('#find nonexisting ents by associated ent ids', async function () {
      let found = await g.findEntities(
        ENT_TYPE1,
        undefined,
        { _type: ASSOC_TYPE2, _id1: [ids[4], ids[5]] },
      );
      expect(found).to.have.lengthOf(2);
    });

    it('#find assocs by type', async function () {
      let assocs = mockAllAssocs(ids, assocIds);
      let assocsFound = await g.findAssocs(ASSOC_TYPE1);
      expect(assocsFound).to.have.lengthOf(3);
      _.each(_.slice(assocs, 6), assoc => {
        expect(assocsFound).to.deep.include(assoc);
      });
    });

    it('#find assocs by id2', async function () {
      let assocs = mockAllAssocs(ids, assocIds);
      let assocsFound = await g.findAssocs(ASSOC_TYPE2, undefined, ids[0]);
      expect(assocsFound).to.have.lengthOf(1);
      expect(assocsFound).to.deep.include(assocs[4]);
    });

    it('#find associated ent ids, forward', async function () {
      let idsFound =
        await g.findEntityIdsViaAssoc(ids[2], ASSOC_TYPE2, 'forward');
      expect(idsFound).to.have.lengthOf(2);
      expect(idsFound).to.deep.include(ids[2]);
      expect(idsFound).to.deep.include(ids[3]);
    });

    it('#find associated ent ids, backward', async function () {
      let idsFound =
        await g.findEntityIdsViaAssoc(ids[1], ASSOC_TYPE2, 'backward');
      expect(idsFound).to.have.lengthOf(1);
      expect(idsFound).to.deep.include(ids[0]);
    });

    it('#find associated ent ids, backward, nonexisting', async function () {
      let idsFound =
        await g.findEntityIdsViaAssoc(ids[3], ASSOC_TYPE1, 'backward');
      expect(idsFound).to.have.lengthOf(0);
    });
  });

  describe('Update', function () {
    let ids, ents;

    before(function () {
      if (!g) {
        this.skip();
      }
    });

    beforeEach(async function () {
      ids = await insertTestEntData();
      ents = await loadAllEnts(ids);
    });

    afterEach(dropDb);

    it('update multiple ents', async function () {
      let updates = _.map(ids, (id, i) => ({ _id: id, up: i }));
      let updatedIds = await g.updateEntities(updates);
      expect(updatedIds).to.have.lengthOf(4);
      _.each(ids, id => {
        expect(updatedIds).to.include(id);
      });
      let updatedEnts = await Promise.all(
        _.map(ids, async id => await g.loadEntity(id)),
      );
      _.each(updatedEnts, (ent, i) => {
        expect(ent).to.deep.include(ents[i]);
        expect(ent).to.deep.include({ up: i });
      })
    });

    it('update a single ent, remove/add a field', async function () {
      let updatedIds = await g.updateEntities([
        { _id: ids[1], up: undefined, z: '78'}, // remove up, add z
      ]);
      expect(updatedIds).to.have.lengthOf(1);
      expect(updatedIds[0]).to.eql(ids[1]);
      let updatedEnt = await g.loadEntity(updatedIds[0]);
      expect(updatedEnt).to.eql(_.merge(ents[1], { z: '78' }));
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
      ids = await insertTestEntData();
      [assocIds, ents] = await Promise.all([
        insertTestAssocData(ids),
        loadAllEnts(ids),
      ]);
    });

    afterEach(dropDb);

    it('delete assocs', async function () {
      let assocs = mockAllAssocs(ids, assocIds);
      let deleted = await g.deleteAssoc([assocIds[6], assocIds[7]]);
      expect(deleted).to.have.lengthOf(2);
      expect(deleted).to.deep.include(assocIds[6]);
      expect(deleted).to.deep.include(assocIds[7]);
      let found = await g.findAssocs(ASSOC_TYPE1);
      expect(found).to.deep.include(assocs[8]);
      found = await g.findAssocs(ASSOC_TYPE2);
      expect(found).to.have.lengthOf(6);
    });

    it('delete ents (side effect delete assocs)', async function () {
      let assocs = mockAllAssocs(ids, assocIds);
      let deleted = await g.deleteEntity([ids[0]]);
      expect(deleted).to.eql([ids[0]]);
      let ent0 = await g.loadEntity(ids[0]);
      expect(ent0).to.be.undefined;
      let assocsFound = await g.findAssocs(ASSOC_TYPE2);
      expect(assocsFound).to.have.lengthOf(3);
      expect(assocsFound).to.deep.include(assocs[2]);
      expect(assocsFound).to.deep.include(assocs[3]);
      expect(assocsFound).to.deep.include(assocs[5]);
      assocsFound = await g.findAssocs(ASSOC_TYPE1);
      expect(assocsFound).to.have.lengthOf(3);
    });
  });
});