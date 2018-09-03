import { MongoGraph } from './MongoGraph';

export type TId = string; // uuid
export const enum TType {
  TestEntType1 = 0,
  TestEntType2 = 1,
  TestAssocType1 = 1000,
  TestAssocType2 = 1001,
};

export type TEntData = Object;
export interface TEnt extends TEntData {
  _id: TId;
  _type: TType;
}
export type TEntQuery = Object;
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
export type TAssocQuery = Object;

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
  findEntities (
    type: TType,
    entQuery?: TEntQuery,
    assocQuery?: TAssocQuery,
    fields?: string[],
  ): Promise<TEntData[]>;
  updateEntities (updates: TEntUpdate[]): Promise<TId[]>;
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
  findEntityIdsViaAssoc (
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