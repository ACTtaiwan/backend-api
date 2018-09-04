import { MongoClient, Db, Collection, Binary } from 'mongodb';
import * as _ from 'lodash';
import { v4 as uuid } from 'uuid';
import { IDataGraph, TType, TEntData, TId, TEnt, TEntQuery, TAssocQuery,
  TEntUpdate, TAssocData, TAssoc } from './DataGraph';
import { MongoDbConfig } from '../../../config/mongodb';
import { DataGraphUtils } from './DataGraphUtils';

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

  public static encodeId (id: TId): Binary {
    let buf = DataGraphUtils.idToBuffer(id);
    if (buf) {
      return new Binary(buf, Binary.SUBTYPE_UUID);
    }
    throw Error(`Cannot encode ID: ${id}`);
  }

  public static decodeId (bin: Binary): TId {
    if (bin.sub_type === Binary.SUBTYPE_UUID && bin.buffer) {
      let id = DataGraphUtils.idFromBuffer(bin.buffer);
      if (id) {
        return id;
      }
    }
    throw Error(`Cannot decode ID: ${bin}`);
  }

  private static createEncodedId (): Binary {
    let id = uuid();
    try {
      return MongoGraph.encodeId(id);
    } catch (err) {
      throw Error(`Cannot create encoded ID: ${id}`);
    }
  }

  /**
   * Insert records to a mongo collection (table).
   *
   * @param table Collection to insert to.
   * @param essentialData Common properties to be inserted to each record.
   *  The property name typically starts with an underscore.
   *  The property '_id' is always auto generated.
   * @param data Array of data objects to be inserted.
   */
  private static async _insertHelper (
    table: Collection,
    essentialData: object,
    data: object[]
  ): Promise<TId[]> {
    let objs = _.map(data, d =>
      _.assign(d, essentialData, { _id: MongoGraph.createEncodedId() }),
    );
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
      { projection: MongoGraph.composeProjection(fields) },
    );
    return ent;
  }

  private static composeQuery (
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

  private static composeProjection (fields: string[], present = true)
  : object {
    if (!fields) {
      return {};
    }
    return _.fromPairs(_.map(fields, f => [f, present]));
  }

  private composeMatchEntIdViaAssocPipes (q: TAssocQuery): object[] {
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
    let match = MongoGraph.composeQuery(q, [filterIdField]);
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
    assocQueries?: TAssocQuery[],
    fields?: string[],
  ): Promise<TEntData[]> {
    let pipeline = [];
    // process entQuery
    entQuery = entQuery || {};
    entQuery['_type'] = type;
    pipeline.push({ $match: MongoGraph.composeQuery(entQuery) });
    // process assocQueries
    let removeTmpFields = false;
    _.each(assocQueries, q => {
      let aggs = this.composeMatchEntIdViaAssocPipes(q);
      _.each(aggs, agg => {
        pipeline.push(agg);
      });
      removeTmpFields = true;
    });
    if (fields) {
      pipeline.push({ $project: MongoGraph.composeProjection(fields) });
    }
    if (removeTmpFields) {
      pipeline.push({ $project: MongoGraph.composeProjection(
        [MongoGraph.ASSOC_LOOKUP_OUTPUT_FIELD],
        false,
      )});
    }
    // execute pipeline
    // console.log(pipeline);
    let cursor = await this._entities.aggregate(pipeline);
    return await cursor.toArray();
  }

  public async updateEntities (updates: TEntUpdate[]): Promise<TId[]> {
    return;
  }

  public async deleteEntity (ids: TId[]): Promise<TId[]> {
    return;
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
    query = MongoGraph.composeQuery(query, ['_id1', '_id2']);

    let cursor = await this._assocs.find(
      query,
      { projection: MongoGraph.composeProjection(fields) }
    );
    return await cursor.toArray();
  }

  public async findAssociatedEntityIds (
    entId: TId,
    assocType: TType,
    direction: 'forward' | 'backward',
  ): Promise<TId[]> {
    return;
  }

  public async deleteAssoc (ids: TId[]): Promise<TId[]> {
    return;
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
