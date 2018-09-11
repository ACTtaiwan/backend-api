import * as _ from 'lodash';
import { Binary } from 'bson';
import { v4 as uuid } from 'uuid';
import { TId, TType, TEntData } from './db/DataGraph';

export abstract class Entity<T = TEntData> {
  protected _id: TId;
  protected constructor (
    protected _type: TType,
    data?: T,
  ) {
    if (data) {
      _.merge(this, data, {_type: _type});
    }
  }

  public get id (): TId {
    return this._id;
  }

  public get type (): TType {
    return this._type;
  }

  // protected abstract validate (): boolean;
  // public abstract compare (e: Entity): number;

  // public equals (e: Entity): boolean {
  //   return this.compare(e) === 0;
  // }

  protected static async load (id: TId, fields?: string[]): Promise<Entity> {
    return;
  }

  // protected async load (fields): Promise<boolean> {
  //   return;
  // }

  public async save (): Promise<boolean> {
    return;
  }

  // public async addAssoc (id2: Id, type: AssocType, assocData): Promise<Assoc> {
  //   return;
  // }

  // public async deleteAssoc (id2: Id, type: AssocType): Promise<boolean> {
  //   return;
  // }

  // public async getAssocEntities (type: AssocType): Promise<Entity[]> {
  //   return;
  // }

}
