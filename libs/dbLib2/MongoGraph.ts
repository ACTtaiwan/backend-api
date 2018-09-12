import { MongoClient, Db, Collection, Binary, Timestamp } from 'mongodb';
import * as _ from 'lodash';
import { v4 as uuid } from 'uuid';
import { IDataGraph, TType, TEntData, TId, TEnt, TEntQuery, TAssocLookupQuery,
  TEntUpdate, TAssocData, TAssoc, DataGraphUtils } from './DataGraph';
import { MongoDbConfig } from '../../config/mongodb';

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
  public static encodeId (id: TId): Binary {
    let buf = DataGraphUtils.idToBuffer(id);
    if (buf) {
      return new Binary(buf, Binary.SUBTYPE_UUID);
    }
    throw Error(`Cannot encode ID: ${id}`);
  }

  /**
   * Decode bson binary-encoded uuid to string
   */
  public static decodeId (bin: Binary): TId {
    if (bin.sub_type === Binary.SUBTYPE_UUID && bin.buffer) {
      let id = DataGraphUtils.idFromBuffer(bin.buffer);
      if (id) {
        return id;
      }
    }
    throw Error(`Cannot decode ID: ${bin}`);
  }

  /**
   * Create a new bson binary-encoded uuid
   */
  private static _createEncodedId (): Binary {
    let id = uuid();
    try {
      return MongoGraph.encodeId(id);
    } catch (err) {
      throw Error(`Cannot create encoded ID: ${id}`);
    }
  }

  /**
   * Insert records to a mongo collection (table). For each record (object),
   * if _id is not specified, a new UUID will be generated. Keys and values in
   * commonData will be inserted to all records (overwrite if key exists).
   *
   * @param table Collection to insert to.
   * @param commonData Common properties to be inserted to all records.
   * @param data Array of data objects to be inserted.
   */
  private static async _insertHelper (
    table: Collection,
    commonData: object,
    data: object[]
  ): Promise<TId[]> {
    let now = new Timestamp(null, null);
    let objs = _.map(data, d => _.assign(
      { _id: MongoGraph._createEncodedId() },
      d,
      commonData,
    ));
    let results = await table.insertMany(objs);
    let insertedIds = _.map(results.insertedIds, id => {
      if (id instanceof Binary) {
        return MongoGraph.decodeId(id);
      }
    });
    return insertedIds;
  }

  public async insertEntities (type: TType, ents: TEntData[])
  : Promise<TId[]> {
    return await MongoGraph._insertHelper(
      this._entities,
      { _type: type },
      ents
    );
  }

  public async loadEntity (id: TId, fields?: string[]): Promise<TEnt> {
    let ent = await this._entities.findOne(
      { _id: MongoGraph.encodeId(id) },
      { projection: MongoGraph._composeProjection(fields) },
    );
    return ent;
  }

  /**
   * Given an object with string keys and scalar or array values, compose
   * a mongo query based on the object. Example:
   * {
   *  a: 'z',
   *  b: [1, 2, 3],
   * }
   * will be composed into:
   * {
   *  a: 'z',
   *  b: { $in: [1, 2, 3] },
   * }
   * If the name of each key is contained in shouldEncodeIdFields, and the
   * corresponding value (or array of values) is a string, it will be encoded
   * into bson binary format.
   * @param condition
   * @param shouldEncodeIdFields
   */
  private static _composeQuery (
    condition: object,
    shouldEncodeIdFields?: string[],
  ): object {
    let shouldEncodeId = _.fromPairs(
      _.map(shouldEncodeIdFields, f => [f, true]),
    );
    let result = _.mapValues(condition, (v, k) => {
      if (Array.isArray(v)) {
        let arr = Array.from(v);
        if (shouldEncodeId[k]) {
          arr = _.map(arr, id => {
            if (typeof id === 'string') {
              return MongoGraph.encodeId(id);
            }
          });
        }
        return { $in: arr };
      } else {
        if (shouldEncodeId[k]) {
          return MongoGraph.encodeId(v);
        }
        return v;
      }
    });

    return result;
  }

  /**
   * Compose a mongo projection.
   */
  private static _composeProjection (fields: string[], present = true)
  : object {
    if (!fields) {
      return {};
    }
    return _.fromPairs(_.map(fields, f => [f, present]));
  }

  /**
   * Given a TAssocLookupQuery object, returns two mongo aggregate pipes.
   * The first pipe is a $lookup, which joins the '_id' of entities with
   * either id1 or id2 of the assocs table. The results are stored as an
   * array of assocs as the '_assocs' field of each entity.
   * The second pipe is a $match, which filter the entities by their '_assocs'
   * fields.
   */
  private _composeAssocLookupQueryPipes (q: TAssocLookupQuery): object[] {
    // determine which assoc field to join with, id1 or id2?
    let joinIdField, filterIdField;
    if (q._id1 && q._id2) {
      throw Error('Invalid TAssocQuery: both _id1 and _id2 are present');
    } else if (q._id1 && !q._id2) {
      joinIdField = '_id2';
      filterIdField = '_id1';
    } else if (!q._id1 && q._id2) {
      joinIdField = '_id1';
      filterIdField = '_id2';
    } else {
      throw Error('Invalid TAssocQuery: both _id1 and _id2 are absent');
    }
    // join
    let lookup = { $lookup: {
        from: this._assocCollectionName,
        localField: '_id',
        foreignField: joinIdField,
        as: MongoGraph.ASSOC_LOOKUP_OUTPUT_FIELD,
    }};

    // after join, filter by the other id field (id2 or id1) and assoc data
    let match = MongoGraph._composeQuery(q, [filterIdField]);
    match = _.set(
      {},
      `$match.${MongoGraph.ASSOC_LOOKUP_OUTPUT_FIELD}.$elemMatch`,
      match,
    );

    return [lookup, match];
  }

  public async findEntities (
    type: TType,
    entQuery?: TEntQuery,
    assocLookupQueries?: TAssocLookupQuery[],
    fields?: string[],
  ): Promise<TEntData[]> {
    let pipeline = [];
    // process entQuery
    entQuery = entQuery || {};
    entQuery['_type'] = type;
    pipeline.push({ $match: MongoGraph._composeQuery(entQuery) });
    // process assocQueries
    let removeTmpFields = false;
    _.each(assocLookupQueries, q => {
      let aggs = this._composeAssocLookupQueryPipes(q);
      _.each(aggs, agg => {
        pipeline.push(agg);
      });
      removeTmpFields = true;
    });
    if (fields) {
      pipeline.push({ $project: MongoGraph._composeProjection(fields) });
    }
    if (removeTmpFields) {
      pipeline.push({ $project: MongoGraph._composeProjection(
        [MongoGraph.ASSOC_LOOKUP_OUTPUT_FIELD],
        false,
      )});
    }
    // execute pipeline
    // console.log(pipeline);
    let cursor = await this._entities.aggregate(pipeline);
    return await cursor.toArray();
  }

  public async updateEntities (updates: TEntUpdate[]): Promise<number> {
    let now = new Timestamp(null, null);
    let bulkUpdate = _.map(updates, update => {
      let id = update._id;
      delete update._id;
      if ('_type' in update) {
        delete update._type;
      }
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
    let results = await this._entities.bulkWrite(bulkUpdate);
    return results.modifiedCount;
  }

  public async deleteEntities (ids: TId[]): Promise<[number, number]> {
    let binIds = _.map(ids, id => MongoGraph.encodeId(id));
    let delEnts = this._entities.deleteMany({ _id: { $in: binIds }});
    let delAssocs = this._assocs.deleteMany({ $or: [
      { _id1: { $in: binIds }},
      { _id2: { $in: binIds }},
    ]});
    let results = await Promise.all([delEnts, delAssocs]);
    return [results[0].deletedCount, results[1].deletedCount];
  }

  public async insertAssoc (
    type: TType,
    id1: TId,
    id2: TId,
    data?: TAssocData,
  ): Promise<TId> {
    let result = await MongoGraph._insertHelper(
      this._assocs,
      {
        _type: type,
        _id1: MongoGraph.encodeId(id1),
        _id2: MongoGraph.encodeId(id2),
      },
      [ data ],
    );
    if (result && result.length === 1) {
      return result[0];
    }
  }

  public async findAssocs (
    type: TType,
    id1?: TId,
    id2?: TId,
    data?: TAssocData,
    fields?: string[],
  ): Promise<TAssoc[]> {
    let query = data || {};
    query['_type'] = type;
    if (id1) {
      query['_id1'] = id1;
    }
    if (id2) {
      query['_id2'] = id2;
    }
    query = MongoGraph._composeQuery(query, ['_id1', '_id2']);

    let cursor = await this._assocs.find(
      query,
      { projection: MongoGraph._composeProjection(fields) }
    );
    return await cursor.toArray();
  }

  public async listAssociatedEntityIds (
    entId: TId,
    assocType: TType,
    direction: 'forward' | 'backward',
  ): Promise<TId[]> {
    let results;
    if (direction === 'forward') {
      results = await this.findAssocs(assocType, entId, null, null, ['_id2']);
      results = _.map(results, r => MongoGraph.decodeId(r['_id2']));
    } else {
      results = await this.findAssocs(assocType, null, entId, null, ['_id1']);
      results = _.map(results, r => MongoGraph.decodeId(r['_id1']));
    }
    return results;
  }

  public async deleteAssocs (ids: TId[]): Promise<number> {
    let binIds = _.map(ids, id => MongoGraph.encodeId(id));
    let results = await this._assocs.deleteMany({ _id: { $in: binIds }});
    return results.deletedCount;
  }

  public async dropDb (): Promise<any> {
    if (this._client && this._db) {
      return await this._db.dropDatabase();
    }
  }

  public async close (): Promise<void> {
    if (this._client) {
      await this._client.close();
    }
  }
}
