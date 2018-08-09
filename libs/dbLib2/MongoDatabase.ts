import { Id, IDatabase } from '.';

export class MongoDatabase implements IDatabase {
  public async query (table: string, constraints: any, projections: any)
  : Promise<any[]> {
    return [];
  }
  insert: (table: string, docs: any[]) => Promise<Id[]>;
  update: (table: string, docs: [Id, any][]) => Promise<Id[]>;
  delete: (table: string, docs: Id[]) => Promise<Id[]>;
}