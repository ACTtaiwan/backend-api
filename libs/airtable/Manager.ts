import * as _ from 'lodash';
import * as assert from 'assert';
import * as airtable from 'airtable'

import { Entity, EntityType, SCHEMAS } from './'

class Cache {
  protected _storage: { [type: string]: { [id: string]: Entity } } = {};

  public put (type: EntityType, id: string, entity: Entity): void {
    if (!(type in this._storage)) {
      this._storage[type] = {};
    }
    this._storage[type][id] = entity;
  }

  public get (type: EntityType, id: string): Entity {
    if (!(type in this._storage)) {
      return null;
    }
    if (!(id in this._storage[type])) {
      return null;
    }
    return this._storage[type][id];
  }

  public delete (type: EntityType, id: string): void {
    if (!(type in this._storage)) {
      return;
    }
    if (!(id in this._storage[type])) {
      return;
    }
    delete this._storage[type][id];
  }

  public printKeys (): void {
    _.each(this._storage, (v, type) =>
      _.each(v, (_entry, id) => {
        console.log(type + ' ' + id);
      })
    );
  }
}

export class Manager {
  protected _db: any;
  protected _cache: Cache;

  protected constructor (apiKey: string, dbId: string) {
    this._db = new airtable({ apiKey: apiKey }).base(dbId);
    this._cache = new Cache();
    this._assertDb();
  }

  protected async _prefetch (): Promise<void> {
    await Promise.all(
      _.map(SCHEMAS, async (schema, type: EntityType) => {
        if (schema.prefetch) {
          await this.list(type);
        }
      }),
    );
  }

  public static async new (apiKey: string, dbId: string)
    : Promise<Manager> {
    let instance = new Manager(apiKey, dbId);
    //await instance._prefetch();
    console.log('prefetch turned off')
    return instance;
  }

  protected _assertDb (): void {
    assert.ok(this._db, 'Could not connect to database');
  }

  // Read a list of entities from remote db
  public async list (type: EntityType, limit: number = 0)
    : Promise<Entity[]> {
    let options: any = {}
    if (limit > 0) {
      options.maxRecords = limit;
      options.pageSize = 1;
    }

    // read raw records
    let shallowEntities = await new Promise<Entity[]>(
      async (resolve) => {
        this._assertDb();
        let results: Entity[] = [];

        this._db(SCHEMAS[type].table).select(options).eachPage(
          (records, fetchNextPage) => {
            results = results.concat(_.map(records, record =>
              Entity._instantiate(
                this,
                type,
                record.id,
                record.fields,
              ),
            ));
            fetchNextPage();
          },
          (err) => {
            if (err) {
              console.error(err);
              resolve(null);
              return;
            }
            resolve(results);
          }
        );
      }
    );
    if (!shallowEntities) {
      return null;
    }
    // resolve referenced entities
    let entities = await Promise.all(_.map(shallowEntities, entity =>
      entity._resolveReferences(),
    ));
    // cache
    _.each(entities, entity => {
      this._cache.put(type, entity.id, entity);
    });

    return entities;
  }

  public async find (type: EntityType, id: string): Promise<Entity> {
    let cached = this._cache.get(type, id);
    if (cached) {
      return cached;
    }
    let shallowEntity = await new Promise<Entity>(
      async resolve => {
        this._assertDb();
        this._db(SCHEMAS[type].table).find(id, (err, record) => {
          if (err) {
            console.error(err);
            resolve(null);
            return;
          }
          let entity = Entity._instantiate(
            this,
            type,
            record.id,
            record.fields,
          );
          resolve(entity);
        });
      }
    );
    if (!shallowEntity) {
      return null;
    }
    let entity = await shallowEntity._resolveReferences();
    this._cache.put(type, id, entity);

    return entity;
  }

  public async create (type: EntityType): Promise<Entity> {
    return new Promise<Entity>(resolve => {
      this._assertDb();
      this._db(SCHEMAS[type].table).create({}, (err, record) => {
        if (err) {
          console.error(err);
          resolve(null);
          return;
        }
        let entity = Entity._instantiate(this, type, record.id, {});
        this._cache.put(type, record.id, entity);
        resolve(entity);
      });
    });
  }

  public async update (type: EntityType, id: string, data: any): Promise<void> {
    return new Promise<void>(resolve => {
      this._assertDb();
      this._db(SCHEMAS[type].table).update(id, data, (err, record) => {
        if (err) {
          console.error(err);
        }
        resolve();
      });
    });
  }

  public async delete (type: EntityType, id: string): Promise<void> {
    return new Promise<void>(resolve => {
      this._assertDb();
      this._db(SCHEMAS[type].table).destroy(id, (err, _record) => {
        if (err) {
          console.error(err);
          resolve();
        }
        this._cache.delete(type, id);
        resolve();
      });
    });
  }

  public _printCache () {
    this._cache.printKeys();
  }
}

