/**
 * Abstract definition of data graph. See MongoGraph for MongoDb implementation.
 */
import * as _ from 'lodash';
import { MongoGraph } from './MongoGraph';
import { MongoDbConfig } from '../../config/mongodb';

export type Id = string; // uuid string
export enum Type {
  Unknown = 0,
  TestEntType1 = 1,
  TestEntType2 = 2,
  Bill = 3,
  Person = 4,
  Tag = 5,
  ArticleSnippet = 6,
  MaxEntityType = 1000,
  TestAssocType1 = 1001,
  TestAssocType2 = 1002,
  Sponsor = 1003,
  Cosponsor = 1004,
  HasTag = 1005,
}
interface IHasType {
  _type: Type;
}
export interface IHasTypeOrTypes {
  _type: Type | Type[];
}
interface IHasId {
  _id: Id;
}
type IHasIdMaybe = Partial<IHasId>;
interface IHasIdPair {
  _id1: Id;
  _id2: Id;
}
type IHasIdPairMaybe = Partial<IHasIdPair>;
type IHasIdOrIdListPairMaybe = {
  [ P in keyof IHasIdPair ]?: IHasIdPair[P] | IHasIdPair[P][];
};
type IHasData = {};

type ElementType<T> = T extends any[] ? T[number] : T;

export type IQueryOperator<T> = {
  _op: string;
  _val: { [K in keyof T]?: ElementType<T[K]> };
};

export interface IEnt extends IHasType, IHasId, IHasData {}
export interface IEntInsert extends IHasType, IHasIdMaybe, IHasData {}
// export interface IEntQuery<T extends IEnt> extends IHasType, IHasIdMaybe, IHasData {}
export type IEntQuery<T extends IEnt = IEnt> = IHasType & IHasIdMaybe & IHasData & {
  [ K in keyof T ]?: T[K] | IQueryOperator<ElementType<T[K]>>;
};

export interface IEntAssocQuery extends IHasTypeOrTypes,
  IHasIdOrIdListPairMaybe, IHasData {}
export interface IUpdate extends IHasId, IHasData {}
export interface IAssoc extends IHasType, IHasId, IHasIdPair, IHasData {}
export interface IAssocInsert extends IHasType, IHasIdMaybe, IHasIdPair,
  IHasData {}
export interface IAssocQuery extends IHasType, IHasIdMaybe, IHasIdPairMaybe,
  IHasData {}
export interface ISortField<T extends IEnt = IEnt> {
  field: (keyof T | string);
  order: 'asc' | 'desc';
}
export interface IAssociatedEntIds extends IHasId, IHasData {}

export function isIEntInsert (obj: any): obj is IEntInsert {
  return '_type' in obj;
}

export function isIAssocInsert (obj: any): obj is IAssocInsert {
  return '_type' in obj && '_id1' in obj && '_id2' in obj;
}

export interface IDataGraph {
  /**
   * @param ents  If _id is not present, a random one wil be generated.
   */
  insertEntities (ents: IEntInsert[]): Promise<Id[]>;
  /**
   * @returns null if not found
   */
  loadEntity (id: Id, fields?: string[]): Promise<IEnt>;
  /**
   *
   * @param entQuery is a structure containing a set of conditions:
   * {
   *    _type: type1,  // or [type1, type2]; required field
   *    key1: val1,
   *    key2: [val2, val3],
   *    ...
   * }
   * The query is evaluated as:
   *    key1 = val1 AND (key2 = val2 OR key2 = val3).
   * When not in an array, a value (e.g., val1) can also be a QueryOperator:
   * {
   *    _op: '>=',        // an operator
   *    _val: some_value,
   * },
   * where some_value can be a value, a list of values, or a recursive query,
   * depending on the operator.
   * Keys can also be a 'path' that refers to a deep field.
   * @param entAssocQueries are structures identical to entQuery, except that
   * the top-level query must also contain either an _id1 or _id2 field.
   * The query filters entities by their assocs. If _id1 is specified, only
   * entities whose assocs satisfy the following conditions will be returned:
   * 1. _id1 satisfy the condition
   * 2. _id2 = each entity itself
   * 3. other conditions in query are satisfied
   * Similarly if _id2 is specified.
   * Fields _id1 and _id2 cannot both appear.
   * All queries in entAssocQueries must be satisfied.
   */
  findEntities<T extends IEnt> (
    entQuery: IEntQuery<T>,
    entAssocQueries?: IEntAssocQuery[],
    fields?: (keyof T | string)[],
    sort?: ISortField<T>[],
    limit?: number,
  ): Promise<T[]>;
  /**
   * Update a set of entities
   *
   * @param updates Each element contains an entity _id and a set of
   * key-value pairs. The entity specified by _id will replace its properties
   * matching the keys with the corresponding values. Properties that are
   * not covered in the keys will remain the same.
   */
  updateEntities (updates: IUpdate[]): Promise<number>;
  /**
   * Delete entities specified by ids together with all assocs referring
   * to them.
   * @param ids
   * @returns Number of entities and assocs deleted (tuple)
   */
  deleteEntities (ids: Id[]): Promise<[number, number]>;
  /**
   * @param assoc If _id is not specified, a random one will be generated
   */
  insertAssocs (assocs: IAssocInsert[]): Promise<Id[]>;
  loadAssoc (id: Id, fields?: string[]): Promise<IAssoc>;
  findAssocs (
    query: IAssocQuery,
    fields?: string[],
    sort?: ISortField[],
  ): Promise<IAssoc[]>;
  updateAssocs (updates: IUpdate[]): Promise<number>;
  /**
   * Convenience function for findAssocs. Returns connected ent IDs only.
   *
   * Given entId, list all entity IDs associated with entId by assoc of
   * type assocType. If direction is 'forward', treat entId as id1.
   * If 'backward', treat entId as id2.
   *
   * @param entId
   * @param assocType
   * @param direction
   * @param assocFields data fields to fetch from each association
   */
  listAssociatedEntityIds (
    entId: Id,
    assocType: Type,
    direction: 'forward' | 'backward',
    assocFields?: string[],
  ): Promise<IAssociatedEntIds[]>;
  deleteAssocs (ids: Id[]): Promise<number>;
  dropDb (): Promise<any>;
  close (): Promise<void>;
}

export class DataGraph {
  protected static _cache: { [key: string]: IDataGraph } = {};

  private constructor () {} // prohibits instantiation

  public static async get (
    type: 'MongoGraph',
    dbName: string,
    entTableName = 'entities',
    assocTableName = 'assocs',
    connectInfo?: any,
  ): Promise<IDataGraph> {
    let cacheKey = JSON.stringify({
      type: type,
      dbName: dbName,
      entTableName: entTableName,
      assocTableName: assocTableName,
      connectInfo: connectInfo,
    });
    if (cacheKey in DataGraph._cache) {
      return DataGraph._cache[cacheKey];
    }

    let g: IDataGraph;
    switch (type) {
      case 'MongoGraph':
        g = await MongoGraph.new(
          dbName,
          entTableName,
          assocTableName,
          connectInfo,
        );
        break;
    }
    if (g) {
      DataGraph._cache[cacheKey] = g;
      return g;
    }
    throw Error(`[DataGraph.create()] Invalid type ${type}`);
  }

  public static async getDefault (): Promise<IDataGraph> {
    return await DataGraph.get('MongoGraph', MongoDbConfig.getDbName());
  }

  public static cleanup () {
    _.each(_.values(DataGraph._cache), g => {
      g.close();
    });
    DataGraph._cache = {};
  }
}

export class DataGraphUtils {
  public static typeIsEnt (t: Type): boolean {
    return t < Type.MaxEntityType;
  }

  public static idFromBuffer (idBuf: Buffer): Id {
    if (!idBuf || idBuf.length !== 16) {
      return;
    }
    let strs = _.map(idBuf, byte => {
      let ret = byte.toString(16);
      if (ret.length < 2) {
        return '0' + ret;
      }
      return ret;
    });
    let i = 0;
    return strs[i++] + strs[i++] + strs[i++] + strs[i++] + '-'
      + strs[i++] + strs[i++] + '-'
      + strs[i++] + strs[i++] + '-'
      + strs[i++] + strs[i++] + '-'
      + strs[i++] + strs[i++] + strs[i++] + strs[i++] + strs[i++] + strs[i++];
  }

  public static idToBuffer (id: Id): Buffer {
    if (!id) {
      return;
    }
    let a = _.filter(id.toLowerCase(), c =>
      (c >= '0' && c <= '9') || (c >= 'a' && c <= 'f')
    );
    if (a.length !== 32) {
      return;
    }
    let bytes = _.map(_.chunk(a, 2), b => parseInt(b[0] + b[1], 16));
    return Buffer.from(bytes);
  }

  /**
   * Runs func(). If throws, retries after delay. Repeats.
   *
   * @param retryDelay can be a number specifying milliseconds, or a function
   * that takes retry counter (1, 2, 3, ...) as input and returns a number.
   * @returns what func() returns.
   */
  public static async retry (
    func: () => Promise<any>,
    retryCount: number = 3,
    retryDelay: number | ((retry: number) => number) = 500,
  ): Promise<any> {
    let retry = 0;
    while (true) {
      try {
        return await func();
      } catch (err) {
        ++retry;
        console.error(`[DataGraphUtils.retry()] retry=${retry}, err=${err}`
          + (err.stack ? `\n${err.stack}` : ''));
        if (retry > retryCount) {
          throw Error(`[DataGraphUtils.retry()] All retries failed`);
        }

        let delay = 0;
        if (typeof(retryDelay) !== 'number') {
          delay = retryDelay(retry);
        } else {
          delay = retryDelay;
        }
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  /**
   * Splits items into chunks, and retries func(chunk) for each chunk.
   * @returns an array of return values from running each chunk.
   */
  public static async retryInChunks (
    func: (chunk: any[]) => Promise<any>,
    items: any[],
    chunkSize: number = 10,
    retryCount: number = 3,
    retryDelay: number | ((retry: number) => number) = 1000,
  ): Promise<any[]> {
    let batches = _.chunk(items, chunkSize);
    let results = [];
    for (const batch of batches) {
      let res = await DataGraphUtils.retry(
        async () => func(batch),
        retryCount,
        retryDelay,
      );
      results.push(res);
    }
    return results;
  }

  /**
   * 0. context = init
   * 1. output = retry func(context)
   * 2. context = updateContext(context, output)
   * 3. repeat 1, 2 until context is undefined
   * @returns an array of output values from func()
   */
  public static async retryLoop (
    func: (context: any) => Promise<any>,
    updateContext: (context: any, prevOutput: Readonly<any>) => any,
    init: any,
    retryCount: number = 3,
    retryDelay: number | ((retry: number) => number) = 1000,
  ): Promise<any[]> {
    let context = init;
    let results = [];
    while (context !== undefined) {
      let output = await DataGraphUtils.retry(
        async () => func(context),
        retryCount,
        retryDelay,
      );
      results.push(output);
      context = updateContext(context, output);
    }
    return results;
  }
}
