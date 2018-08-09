import { Id, EntityType, AssocType, Assoc } from '.'

export class Entity {
  protected _id: Id;

  constructor (protected _type: EntityType, data) {}

  public static async load (type: EntityType, constraints, fields)
      : Promise<Entity[]> {
    return;
  }

  public async save (): Promise<boolean> {
    return;
  }

  public async addAssoc (id2: Id, type: AssocType, assocData): Promise<Assoc> {
    return;
  }

  public async deleteAssoc (id2: Id, type: AssocType): Promise<boolean> {
    return;
  }

  public async getAssocEntities (type: AssocType): Promise<Entity[]> {
    return;
  }

}
