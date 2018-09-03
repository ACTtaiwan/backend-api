import { MongoClient, Db, Collection, Binary } from 'mongodb';
import * as _ from 'lodash';
import { v4 as uuid } from 'uuid';
import { IDataGraph, TType, TEntData, TId, TEnt, TEntQuery, TAssocQuery,
  TEntUpdate, TAssocData, TAssoc } from './DataGraph';
import { MongoDbConfig } from '../../../config/mongodb';
import { DataGraphUtils } from './DataGraphUtils';

export class MongoGraph implements IDataGraph {
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

  private static makeId (id?: TId): Binary {
    let buf: Buffer;
    if (id) {
      buf = DataGraphUtils.idToBuffer(id);
      if (!buf) {
        console.error(`MongoGraph.makeId(): cannot convert ${id} to ID`);
      }
    }
    if (!buf) {
      // if no id or a bad id is specified, generate a new one
      buf = uuid(null, Buffer.alloc(16));
    }
    return new Binary(buf, Binary.SUBTYPE_UUID);
  }

  /**
   *
   * @param table Collection to insert to.
   * @param essentialData Common properties to be inserted to each record.
   *  The property name typically starts with an underscore.
   *  The property '_id' is always auto generated.
   * @param data Array of data objects to be inserted.
   */
  private static async _insertHelper (
    table: Collection,
    essentialData: Object,
    data: Object[]
  ): Promise<TId[]> {
    let objs = _.map(data, d =>
      _.assign(d, essentialData, { _id: MongoGraph.makeId() }),
    );
    let results = await table.insertMany(objs);
    let insertedIds = _.map(results.insertedIds, binaryId =>
      DataGraphUtils.idFromBuffer(binaryId['buffer']),
    );
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
    return;
  }

  public async findEntities (
    type: TType,
    entQuery?: TEntQuery,
    assocQuery?: TAssocQuery,
    fields?: string[],
  ): Promise<TEntData[]> {
    return;
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
    return (await MongoGraph._insertHelper(
      this._assocs,
      {
        _type: type,
        _id1: MongoGraph.makeId(id1),
        _id2: MongoGraph.makeId(id2),
      },
      [ data ],
    ))[0];
  }

  public async findAssocs (
    type: TType,
    id1?: TId,
    id2?: TId,
    data?: TAssocData,
    fields?: string[],
  ): Promise<TAssoc[]> {
    return;
  }

  public async findEntityIdsViaAssoc (
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
