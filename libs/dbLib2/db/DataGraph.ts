/**
 * Abstract definition of data graph. See MongoGraph for MongoDb implementation.
 */
import { MongoGraph } from './MongoGraph';

export type TId = string; // uuid string
export const enum TType {
  Unknown = 0,
  TestEntType1 = 1,
  TestEntType2 = 2,
  TestAssocType1 = 1001,
  TestAssocType2 = 1002,
};

export type TEntData = object;
export interface TEnt extends TEntData {
  _id: TId;
  _type: TType;
}
export type TEntQuery = object;
export type TEntUpdate = {
  _id: TId;
  [key: string]: any;
}

export type TAssocData = { [key: string]: any };  // underscore fields ignored
export type TAssoc = {
  _id: TId;
  _type: TType;
  _id1: TId;
  _id2: TId;
  [key: string]: any;
}
export type TAssocLookupQuery = {
  _type: TType;
  _id1?: TId | TId[];
  _id2?: TId | TId[];
  [key: string]: any;
};

export interface IDataGraph {
  insertEntities (type: TType, ents: TEntData[]): Promise<TId[]>;
  loadEntity (id: TId, fields?: string[]): Promise<TEnt>;
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
   * @param assocLookupQueries Example:
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
    type: TType,
    entQuery?: TEntQuery,
    assocLookupQueries?: TAssocLookupQuery[],
    fields?: string[],
  ): Promise<TEntData[]>;
  /**
   * Update a set of entities
   *
   * @param updates Each element contains an entity _id and a set of
   * key-value pairs. The entity specified by _id will replace its properties
   * matching the keys with the corresponding values. Properties that are
   * not covered in the keys will remain the same.
   */
  updateEntities (updates: TEntUpdate[]): Promise<number>;
  deleteEntity (ids: TId[]): Promise<TId[]>;
  insertAssoc (type: TType, id1: TId, id2: TId, data?: TAssocData)
  : Promise<TId>;
  findAssocs (
    type: TType,
    id1?: TId,
    id2?: TId,
    data?: TAssocData,
    fields?: string[],
  ): Promise<TAssoc[]>;
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
    entId: TId,
    assocType: TType,
    direction: 'forward' | 'backward',
  ): Promise<TId[]>;
  deleteAssoc (ids: TId[]): Promise<TId[]>;
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
    let e: TEnt;
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
      default:
        break;
    }
    return g;
  }
}