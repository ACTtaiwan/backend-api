import { MongoClient, Db, Collection, Binary } from 'mongodb';
import * as _ from 'lodash';
import { v4 as uuid } from 'uuid';
import { IDataGraph, Type, Id, IEnt, IEntQuery, IEntAssocQuery,
  IUpdate, IAssoc, DataGraphUtils, IAssocQuery, IEntInsert,
  IAssocInsert, ISortField, IQueryOperator } from './DataGraph';
import { MongoDbConfig } from '../../config/mongodb';
import { expect } from 'chai';
import { Logger } from './Logger';

export function isQueryOperator<T extends IEnt> (o: any): o is IQueryOperator<T> {
  return typeof o === 'object' && o['_op'] && o['_val'];
}

class PageCursor {
  constructor (
    protected _sortFields: ISortField[],
    protected _record?: object,
    protected _totalSize: number = 0,
  ) {
    this._sortFields = this._sortFields || [];
    if (
      this._sortFields.length <= 0 ||
      this._sortFields[this._sortFields.length - 1].field !== '_id'
    ) {
      // always include _id as the last sorting fields (ultimate tie breaker)
      this._sortFields.push({ field: '_id', order: 'asc' });
    }
  }

  public set record (r: object) {
    this._record = r;
  }

  public incrementTotalSize (s: number) {
    this._totalSize += s;
  }

  public get totalSize (): number {
    return this._totalSize;
  }

  public toQuery (): object {
    if (!this._record) {
      return {};
    }
    let queryPairs = _.map(this._sortFields, sf => {
      if (!(sf.field in this._record)) {
        return;
      }
      let op;
      if (sf.order === 'asc') {
        op = '$gt';
      } else {
        op = '$lt';
      }
      if (sf.field !== '_id') {
        op += 'e';
      }
      return [ sf.field, { [op]: this._record[sf.field] } ];
    });
    queryPairs = _.filter(queryPairs, q => q !== undefined);
    return _.fromPairs(queryPairs);
  }

  public toSort (): object {
    let queryPairs = _.map(this._sortFields, sf =>
      [ sf.field, sf.order === 'asc' ? 1 : -1 ],
    );
    return _.fromPairs(queryPairs);
  }
}

export class MongoGraph implements IDataGraph {
  private static readonly ASSOC_LOOKUP_OUTPUT_FIELD = '_assocs';

  // factory method
  public static async new (
    dbName: string,
    entityCollectionName: string,
    assocCollectionName: string,
    url: string,
  ): Promise<MongoGraph> {
    if (!url) {
      url = await MongoDbConfig.getUrl();
    }
    let instance = new MongoGraph(
      dbName,
      entityCollectionName,
      assocCollectionName,
      url,
    );
    return await instance._init();
  }

  protected _client: MongoClient;
  protected _db: Db;
  protected _entities: Collection;
  protected _assocs: Collection;

  protected constructor (
    protected _dbName: string,
    protected _entityCollectionName: string,
    protected _assocCollectionName: string,
    protected _url: string,
  ) {}

  protected async _init (): Promise<MongoGraph> {
    try {
      this._client = await MongoClient.connect(
        this._url,
        { useNewUrlParser: true },
      );
      this._db = this._client.db(this._dbName);
      this._entities = this._db.collection(this._entityCollectionName);
      this._assocs = this._db.collection(this._assocCollectionName);
    } catch (err) {
      console.error(err);
      return;
    }
    return this;
  }

  /**
   * Encode string uuid into bson binary format
   */
  public static encodeId (id: Id): Binary {
    let buf = DataGraphUtils.idToBuffer(id);
    if (buf) {
      return new Binary(buf, Binary.SUBTYPE_UUID);
    }
    throw Error(`[MongoGraph.encodeId()] cannot encode ID: ${id}`);
  }

  /**
   * Decode bson binary-encoded uuid to string
   */
  public static decodeId (bin: Binary): Id {
    if (bin.sub_type === Binary.SUBTYPE_UUID && bin.buffer) {
      let id = DataGraphUtils.idFromBuffer(bin.buffer);
      if (id) {
        return id;
      }
    }
    throw Error(`[MongoGraph.decodeId()] cannot decode ID: ${bin}`);
  }

  private static _encodeIdFields (input: any, nested = false): object {
    if (Array.isArray(input)) {
      return _.map(input, elm => MongoGraph._encodeIdFields(elm, true));
    } else if (typeof input === 'string') {
      return MongoGraph.encodeId(input);
    } else if (typeof input === 'object') {
      return _.mapValues(input, (v: any, k) => {
        if (nested || k === '_id' || k === '_id1' || k === '_id2') {
          return MongoGraph._encodeIdFields(v, true);
        }
        return v;
      });
    }
  }

  private static _decodeIdFields (obj: object): object {
    return _.mapValues(obj, (v: any, k) => {
      if (k === '_id' || k === '_id1' || k === '_id2') {
        if (Array.isArray(v)) {
          return _.map(v, (binId: Binary) => MongoGraph.decodeId(binId));
        } else {
          return MongoGraph.decodeId(v);
        }
      }
      return v;
    });
  }

  /**
   * Insert records to a mongo collection (table). For each record (object),
   * if _id is not specified, a new UUID will be generated.
   *
   * @param table Collection to insert to.
   * @param objs Array of data objects to be inserted.
   */
  private static async _insertHelper (
    table: Collection,
    objs: IEntInsert[] | IAssocInsert[],
  ): Promise<Id[]> {
    let docs = _.map(objs, obj => {
      if (!obj._id) {
        obj._id = uuid();
      }
      return MongoGraph._encodeIdFields(obj);
    });
    let results = await DataGraphUtils.retryInChunks(
      items => table.insertMany(items),
      docs,
    );
    let insertedIds = _.reduce(results, (ids, result) => {
      if (result && result.insertedIds) {
        return ids = _.concat(ids, _.values(result.insertedIds));
      }
      return ids;
    }, []);
    return _.map(insertedIds, id => {
      if (id instanceof Binary) {
        return MongoGraph.decodeId(id);
      }
    });
  }

  public async insertEntities (ents: IEntInsert[]): Promise<Id[]> {
    let logger = new Logger('MongoGraph').in('insertEntities');
    logger.log(`inserting ${ents.length} ents`);
    let ids = await MongoGraph._insertHelper(this._entities, ents);
    logger.log(`inserted ${ids.length} ents: ${JSON.stringify(ids)}`);
    return ids;
  }

  private static async _loadHelper (
    table: Collection,
    id: Id,
    fields?: string[],
  ): Promise<object> {
    let ent = await table.findOne(
      MongoGraph._encodeIdFields({ _id: id }),
      { projection: MongoGraph._composeProjection(fields) },
    );
    if (!ent) {
      return null;
    }
    let ret = MongoGraph._decodeIdFields(ent);
    expect(ret).to.include.all.keys('_id', '_type');
    return ret;
  }

  public async loadEntity (id: Id, fields?: string[]): Promise<IEnt> {
    let ret = await MongoGraph._loadHelper(this._entities, id, fields);
    return <IEnt>ret;
  }

  private static _composeQuery (
    condition: object,
    cursor?: PageCursor,
    isNested: boolean = false,
  ): object {
    let query: object = _.mapValues(condition, v => {
      if (Array.isArray(v)) {
        return { $in: v };
      } else if (isQueryOperator(v)) {
        switch (v['_op']) {
          case 'has_any':
            return {
              $elemMatch: MongoGraph._composeQuery(v['_val'], null, true),
            };
          case '>':
            return { $gt: v['_val'] };
          case '>=':
            return { $gte: v['_val'] };
          case '<':
            return { $lt: v['_val'] };
          case '<=':
            return { $lte: v['_val'] };
          default:
            throw Error(`Unknown operator ${v['_op']} in ${v}`);
        }
      } else {
        return v;
      }
    });
    query = MongoGraph._encodeIdFields(query);

    if (cursor) {
      let cursorQuery = cursor.toQuery();
      _.mergeWith(query, cursorQuery, (v, cv, k) => {
        if (v !== undefined && cv !== undefined) {
          return { $and: [{ [k]: v }, { [k]: cv }]};
        }
      });
    }
    if (!isNested) {
      expect(query).to.include.all.keys('_type');
    }

    return query;
  }

  /**
   * Compose a mongo projection.
   */
  private static _composeProjection (fields: string[], present = true)
  : object {
    if (!fields) {
      return {};
    }
    if (present) {
      fields.push('_type'); // always include _type field
    }
    return _.fromPairs(_.map(fields, f => [f, present]));
  }

  /**
   * Given IEntAssocQuery objects, returns a list of mongo aggregate pipes.
   */
  private _composePipesForEntAssocQueries (queries: IEntAssocQuery[])
  : object[] {
    let res = [];
    // determine if we need to lookup _id1, _id2, or both from the assoc table
    let needId1 = false, needId2 = false;
    _.each(queries, q => {
      if (q._id1 && q._id2) {
        throw Error('Invalid TAssocQuery: both _id1 and _id2 are present');
      } else if (q._id1 && !q._id2) {
        needId1 = true;
      } else if (!q._id1 && q._id2) {
        needId2 = true;
      } else {
        throw Error('Invalid TAssocQuery: both _id1 and _id2 are absent');
      }
    });
    // compose lookup pipeline
    if (needId1) {
      res.push({ $lookup: {
        from: this._assocCollectionName,
        localField: '_id',
        foreignField: '_id2',
        as: '_id1',
      }});
    }
    if (needId2) {
      res.push({ $lookup: {
        from: this._assocCollectionName,
        localField: '_id',
        foreignField: '_id1',
        as: '_id2',
      }});
    }
    // compose filter (match) pipelines
    _.each(queries, q => {
      let f = q['_id1'] ? '_id1' : '_id2';
      res.push({ $match: { [f]: { $elemMatch: MongoGraph._composeQuery(q) }}});
    });
    // remove tmp fields
    let tmpFieldsToRemove = [];
    if (needId1) {
      tmpFieldsToRemove.push('_id1');
    }
    if (needId2) {
      tmpFieldsToRemove.push('_id2');
    }
    if (tmpFieldsToRemove.length > 0) {
      res.push({
        $project: MongoGraph._composeProjection(tmpFieldsToRemove, false),
      });
    }

    return res;
  }

  public async findEntities<T extends IEnt> (
    entQuery: IEntQuery<T>,
    entAssocQueries?: IEntAssocQuery[],
    fields?: (keyof T | string)[],
    sort?: ISortField[],
    limit?: number,
    readPageSize: number = MongoDbConfig.getReadPageSize(),
  ): Promise<T[]> {
    let logger = new Logger('MongoGraph').in('findEntities');
    logger.log(JSON.stringify({
      entQuery: entQuery,
      entAssocQueries: entAssocQueries,
      fields: fields,
      sort: sort,
      readPageSize: readPageSize,
    }));

    sort = sort || [];
    sort.push({ field: '_id', order: 'asc' });

    // explicitly include sort fields in projection; otherwise won't sort
    if (fields) {
      let fset = new Set(fields);
      _.each(sort, s => {
        if (!(s.field in fset)) {
          fields.push(s.field);
        }
      });
    }

    let results = await DataGraphUtils.retryLoop(
      async cursor => {
        let pipeline = [];
        // process entQuery
        pipeline.push({ $match: MongoGraph._composeQuery(entQuery, cursor) });
        // process assocQueries
        _.each(this._composePipesForEntAssocQueries(entAssocQueries), pipe => {
          pipeline.push(pipe);
        });
        if (fields) {
          pipeline.push({ $project: MongoGraph._composeProjection(fields as string[]) });
        }
        pipeline.push({ $sort: cursor.toSort() });
        pipeline.push({ $limit: limit ?
          _.min([readPageSize, limit - cursor.totalSize]) :
          readPageSize,
        });
        // console.dir(pipeline, { depth: null});

        return await this._entities.aggregate(pipeline).toArray();
      },
      (cursor, output) => { // returns cursor
        if (output && Array.isArray(output) && output.length === readPageSize) {
          cursor.record = output[output.length - 1];
          cursor.incrementTotalSize(output.length);
          return cursor;
        }
      },
      new PageCursor(sort),
    );

    let ents = _.map(_.flatten(results), e => {
      let ret = <T>MongoGraph._decodeIdFields(e);
      expect(ret).to.include.all.keys('_id', '_type');
      return ret;
    });

    logger.log(`found ${ents.length}`);
    return ents;
  }

  private static async _updateHelper (
    table: Collection,
    updates: IUpdate[],
    prohibitedFields?: string[],
  ): Promise<number> {
    let bulkUpdate = _.map(updates, update => {
      let id = update._id;
      delete update._id;
      _.each(prohibitedFields, f => {
        if (f in update) {
          delete update[f];
        }
      });
      let u = {};
      let set = _.pickBy(update, v => v !== undefined);
      if (_.keys(set).length > 0) {
        u['$set'] = set;
      }
      let unset = _.pickBy(update, v => v === undefined);
      if (_.keys(unset).length > 0) {
        u['$unset'] = unset;
      }
      return {
        updateOne: {
          filter: { _id: MongoGraph.encodeId(id) },
          update: _.pickBy(u),
        },
      };
    });
    let results = await DataGraphUtils.retryInChunks(
      items => table.bulkWrite(items),
      bulkUpdate,
    );
    return _.reduce(
      results,
      (count, result) => count += (result && result.modifiedCount) ?
        result.modifiedCount : 0,
      0
    );

  }

  public async updateEntities (updates: IUpdate[]): Promise<number> {
    let logger = new Logger('MongoGraph').in('updateEntities');
    logger.log(`updating ${updates.length}: `
      + JSON.stringify(_.map(updates, u => u._id)));
    let updateCount = await MongoGraph._updateHelper(
      this._entities,
      updates,
      [ '_type' ],
    );
    logger.log(`updated ${updateCount}`);
    return updateCount;
  }

  public async deleteEntities (ids: Id[]): Promise<[number, number]> {
    let logger = new Logger('MongoGraph').in('deleteEntities');
    logger.log(`deleting ${ids.length}: ${JSON.stringify(ids)}`);
    let binIds = _.map(ids, id => MongoGraph.encodeId(id));
    let promiseDeleteEnts = DataGraphUtils.retryInChunks(
      items => this._entities.deleteMany({ _id: { $in: items }}),
      binIds,
    );
    let promiseDeleteAssosc = DataGraphUtils.retryInChunks(
      items => this._assocs.deleteMany({ $or: [
        { _id1: { $in: items }},
        { _id2: { $in: items }},
      ]}),
      binIds,
    );
    let resPair = await Promise.all([promiseDeleteEnts, promiseDeleteAssosc]);
    let [entCount, assocCount] = <[number, number]>_.map(resPair, results => {
      return _.reduce(
        results,
        (count, r) => count += (r && r.deletedCount) ? r.deletedCount : 0,
        0,
      );
    });
    logger.log(`deleted ${entCount} ents and ${assocCount} assocs`);
    return [entCount, assocCount];
  }

  public async insertAssocs (
    assocs: IAssoc[],
  ): Promise<Id[]> {
    let logger = new Logger('MongoGraph').in('insertAssocs');
    logger.log(`inserting ${assocs.length} assocs`);
    let ids = await MongoGraph._insertHelper(this._assocs, assocs);
    logger.log(`inserted ${assocs.length} assocs: ${JSON.stringify(ids)}`);
    return ids;
  }

  public async loadAssoc (id: Id, fields?: string[]): Promise<IAssoc> {
    let ret = await MongoGraph._loadHelper(this._assocs, id, fields);
    return <IAssoc>ret;
  }

  public async findAssocs (
    query: IAssocQuery,
    fields?: string[],
    sort?: ISortField[],
    readPageSize: number = MongoDbConfig.getReadPageSize(),
  ): Promise<IAssoc[]> {
    let logger = new Logger('MongoGraph').in('findAssocs');
    logger.log(JSON.stringify({
      query: query,
      fields: fields,
      sort: sort,
      readPageSize: readPageSize,
    }));

    sort = sort || [];
    sort.push({ field: '_id', order: 'asc' });

    if (fields) {
      fields.push('_id1', '_id2');

      // explicitly include sort fields in projection; otherwise won't sort
      let fset = new Set(fields);
      _.each(sort, s => {
        if (!(s.field in fset)) {
          fields.push(s.field);
        }
      });
    }

    let results = await DataGraphUtils.retryLoop(
      async cursor => {
        let q = this._assocs.find(
          MongoGraph._composeQuery(query, cursor),
          { projection: MongoGraph._composeProjection(fields) }
        )
        .sort(cursor.toSort())
        .limit(readPageSize);
        return await q.toArray();
      },
      (cursor, output) => {
        if (output && Array.isArray(output) && output.length === readPageSize) {
          cursor.record = output[output.length - 1];
          return cursor;
        }
      },
      new PageCursor(sort),
    );

    let assocs = _.map(_.flatten(results), a => {
      let ret = <IAssoc>MongoGraph._decodeIdFields(a);
      expect(ret).to.include.all.keys('_id', '_type', '_id1', '_id2');
      return ret;
    });

    logger.log(`found ${assocs.length}`);
    return assocs;
  }

  public async listAssociatedEntityIds (
    entId: Id,
    assocType: Type,
    direction: 'forward' | 'backward',
  ): Promise<Id[]> {
    let results;
    let q = { _type: assocType };
    let self, other;
    if (direction === 'forward') {
      self = '_id1';
      other = '_id2';
    } else {
      self = '_id2';
      other = '_id1';
    }
    q[self] = entId;
    results = await this.findAssocs(q, [ other ]);
    return _.map(results, r => r[other]);
  }

  public async updateAssocs (updates: IUpdate[]): Promise<number> {
    let logger = new Logger('MongoGraph').in('updateAssocs');
    logger.log(`updating ${updates.length}: `
      + JSON.stringify(_.map(updates, u => u._id)));
    let updateCount = await MongoGraph._updateHelper(
      this._assocs,
      updates,
      [ '_type', '_id1', '_id2' ],
    );
    logger.log(`updated ${updateCount}`);
    return updateCount;
  }

  public async deleteAssocs (ids: Id[]): Promise<number> {
    let logger = new Logger('MongoGraph').in('deleteAssocs');
    logger.log(`deleting ${ids.length}: ${JSON.stringify(ids)}`);
    let binIds = _.map(ids, id => MongoGraph.encodeId(id));
    let results = await DataGraphUtils.retryInChunks(
      items => this._assocs.deleteMany({ _id: { $in: items }}),
      binIds,
    );
    let count = _.reduce(
      results,
      (count, result) => count += (result && result.deletedCount) ?
        result.deletedCount : 0,
      0,
    );
    logger.log(`deleted ${count}`);
    return count;
  }

  public async dropDb (): Promise<any> {
    if (this._client && this._db) {
      Logger.log(`${this._db}`, 'MongoGraph.dropDb');
      return await this._db.dropDatabase();
    }
  }

  public async close (): Promise<void> {
    if (this._client) {
      await this._client.close();
    }
  }
}
