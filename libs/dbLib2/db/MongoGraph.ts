import { MongoClient, Db, Collection } from 'mongodb';

type TId = string;

type TEntType = string;
type TEntData = { [key: string]: any }; // underscore fields ignored
type TEnt = {
  _id: TId;
  _type: TEntType;
  [key: string]: any;
}
type TEntQuery = Object;
type TEntUpdate = {
  _id: TId;
  [key: string]: any;
}

type TAssocType = string;
type TAssocData = { [key: string]: any };  // underscore fields ignored
type TAssoc = {
  _id: TId;
  _type: TAssocType;
  _id1: TId;
  _id2: TId;
  [key: string]: any;
}
type TAssocQuery = Object;

export class MongoGraph {
  // factory method
  public static async new (
    url: string,
    dbName: string,
    entityCollectionName: string,
    assocCollectionName: string
  ): Promise<MongoGraph> {
    let instance = new MongoGraph(
      url,
      dbName,
      entityCollectionName,
      assocCollectionName,
    );
    return await instance._init();
  }

  protected _client: MongoClient;
  protected _db: Db;
  protected _entities: Collection;
  protected _assocs: Collection;

  protected constructor (
    protected _url: string,
    protected _dbName: string,
    protected _entityCollectionName: string,
    protected _assocCollectionName: string,
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

  /**
   * 
   * @param type Entity type
   * @param entQuery Example:
   * {
   *    field1: value1,
   *    field2: [value2, value3, value4],
   *    ...
   * }
   * Returned entities satisfy: 
   *    field1 = value1 AND field2 = value2 OR value3 OR value4
   * Field name could also be a json 'path' that refers to a deep field
   * @param assocQuery Example:
   * {
   *    _type: assoc_type,         // required
   *    _id1: [value1, value2],    // or _id2; value could be a single value
   * }
   * Returned entities satisfy the condition that there exists an assoc where: 
   *  1. _type = assoc_type
   *  2. _id1 = value1 OR value2
   *  3. _id2 = self
   * Fields _id1 and _id2 cannot both appear.
   */
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
    data?: TAssocData
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

  public async dropDb () {
    if (this._client && this._db) {
      await this._db.dropDatabase();
    }
  }

  public close () {
    if (this._client) {
      this._client.close();
    }
  }
}
