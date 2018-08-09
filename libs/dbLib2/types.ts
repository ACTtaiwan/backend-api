export type Id = string;
export type EntityType = string;
export type AssocType = string;

export interface IDatabase {
  query: (table: string, constraints: any, projections: any) => Promise<any[]>;
  insert: (table: string, docs: any[]) => Promise<Id[]>;
  update: (table: string, docs: [Id, any][]) => Promise<Id[]>;
  delete: (table: string, docs: Id[]) => Promise<Id[]>;
}