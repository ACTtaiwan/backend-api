import { MongoClient, Db, Collection } from 'mongodb';
import { IDataGraph, TEntType, TEntData, TId, TEnt, TEntQuery, TAssocQuery,
  TEntUpdate, TAssocType, TAssocData, TAssoc } from './DataGraph';

export class MongoGraph implements IDataGraph {
  // factory method
  public static async new (
    dbName: string,
    entityCollectionName: string,
    assocCollectionName: string,
    url: string,
  ): Promise<MongoGraph> {
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

  public async insertEntities (type: TEntType, ents: TEntData[])
  : Promise<TId[]> {
    // let results = await this._entities.insertMany(entities);
    // return Object.values(results.insertedIds);
    return;
  }

  public async loadEntity (id: TId, fields?: string[]): Promise<TEnt> {
    return;
  }

  public async findEntities (
    type: TEntType,
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
    type: TAssocType,
    id1: TId,
    id2: TId,
    data?: TAssocData,
  ): Promise<TId> {
    return;
  }

  public async findAssocs (
    type: TAssocType,
    id1?: TId,
    id2?: TId,
    data?: TAssocData,
    fields?: string[],
  ): Promise<TAssoc[]> {
    return;
  }

  public async findEntityIdsViaAssoc (
    entId: TId,
    assocType: TAssocType,
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
