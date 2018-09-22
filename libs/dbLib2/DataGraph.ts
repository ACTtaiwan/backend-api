/**
 * Abstract definition of data graph. See MongoGraph for MongoDb implementation.
 */
import * as _ from 'lodash';
import { MongoGraph } from './MongoGraph';

export type Id = string; // uuid string
export const enum Type {
  Unknown = 0,
  TestEntType1 = 1,
  TestEntType2 = 2,
  Bill = 3,
  TestAssocType1 = 1001,
  TestAssocType2 = 1002,
};
export interface IHasType {
  _type: Type;
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
}
type IHasData = {
  [ k: string ]: any;
}
export interface IEnt extends IHasType, IHasId {}
export interface IEntInsert extends IHasType, IHasIdMaybe, IHasData {}
export interface IEntQuery extends IHasType, IHasIdMaybe, IHasData {}
export interface IEntAssocQuery extends IHasType, IHasIdOrIdListPairMaybe,
  IHasData {}
export interface IUpdate extends IHasId, IHasData {}
export interface IAssoc extends IHasType, IHasId, IHasIdPair, IHasData {}
export interface IAssocInsert extends IHasType, IHasIdMaybe, IHasIdPair,
  IHasData {}
export interface IAssocQuery extends IHasType, IHasIdMaybe, IHasIdPairMaybe,
  IHasData {}

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
   * @param entQuery Example:
   * {
   *    _type: someType, // required
   *    field1: value1,
   *    field2: [value2, value3, value4],
   *    ...
   * }
   * Returned entities satisfy:
   *    field1 = value1 AND field2 = value2 OR value3 OR value4
   * Field name could also be a json 'path' that refers to a deep field
   * @param entAssocQueries Example:
   * {
   *    _type: assoc_type,         // required
   *    _id1: [value1, value2],    // or _id2; value could be a single value
   *    ...                        // filter by assoc properties
   * }
   * Returned entities satisfy the condition that there exists an assoc where:
   *  1. _type = assoc_type
   *  2. _id1 = value1 OR value2
   *  3. _id2 = self
   *  4. assoc properties matches (if any)
   * Fields _id1 and _id2 cannot both appear.
   */
  findEntities (
    entQuery: IEntQuery,
    entAssocQueries?: IEntAssocQuery[],
    fields?: string[],
    // TODO: support pagination
  ): Promise<IEnt[]>;
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
    assocQuery: IAssocQuery,
    fields?: string[],
    // TODO: support pagination
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
   */
  listAssociatedEntityIds (
    entId: Id,
    assocType: Type,
    direction: 'forward' | 'backward',
  ): Promise<Id[]>;
  deleteAssocs (ids: Id[]): Promise<number>;
  dropDb (): Promise<any>;
  close (): Promise<void>;
}

export class DataGraph {
  public static async create (
    type: string,
    dbName: string,
    entTableName = 'entities',
    assocTableName = 'assocs',
    connectInfo?: any,
  ): Promise<IDataGraph> {
    switch (type) {
      case 'MongoGraph':
        return await MongoGraph.new(
          dbName,
          entTableName,
          assocTableName,
          connectInfo,
        );
    }
    throw Error(`[DataGraph.create()] Invalid type ${type}`);
  }
}

export class DataGraphUtils {
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
    };
    return results;
  }

  /**
   * 0. input = init
   * 1. output = retry func(input)
   * 2. input = transform(output)
   * 3. repeat 1, 2 until input is undefined
   * @returns an array of output values from func()
   */
  public static async retryLoop (
    func: (item: any) => Promise<any>,
    transform: (prevOutput: Readonly<any>) => any,
    init: any,
    retryCount: number = 3,
    retryDelay: number | ((retry: number) => number) = 1000,
  ): Promise<any[]> {
    let input = init;
    let results = [];
    while (input !== undefined) {
      let output = await DataGraphUtils.retry(
        async () => func(input),
        retryCount,
        retryDelay,
      );
      results.push(output);
      input = transform(output);
    }
    return results;
  }
}
