import * as _ from 'lodash';
import * as assert from 'assert';

import { Manager, EntityType, Schema, SCHEMAS } from './';

export class Entity {
  protected _data: { [key: string]: any } = {};

  protected constructor (
    protected _manager: Manager,
    public readonly type: EntityType,
    public readonly id: string,
  ) {}

  public static async _new (
    manager: Manager,
    type: EntityType,
    id: string,
    data: { [key: string]: any },
  ): Promise<Entity> {
    let entity = new Entity(manager, type, id);
    return await entity._load(data);
  }

  protected async _load (data: { [key: string]: any }): Promise<Entity> {
    // validate fields and resolve references in data
    let newDataWithPromises = _.chain(data)
      .pickBy((_value, key) => key in this.schema.fields)
      .mapValues(async (value, field) => {
        let type = this.schema.fields[field];
        if (type) {
          return await Promise.all(_.map(<string[]>value, async id =>
            await this._manager.find(type, id),
          ));
        } else {
          return value;
        }
      })
      .value();
    let newDataKeys = Object.keys(newDataWithPromises);
    let newDataValues = await Promise.all(_.map(newDataKeys, async key =>
      await newDataWithPromises[key],
    ));
    let newData = _.zipObject(newDataKeys, newDataValues);

    this._data = _.assign(this._data, newData);
    return this;
  }

  public get schema (): Schema {
    let schema = SCHEMAS[this.type];
    assert.ok(schema, `Cannot find schema for type ${this.type}`);
    return schema;
  }

  public get (name: string): any {
    return this._data[name];
  }

  public set (name: string, value: any): void {
    assert.ok(name in this.schema.fields, `Field does not exist: ${name}`);
    let type = this.schema.fields[name];
    if (type) {
      let entities = <Entity[]>value;

      if (value instanceof Array) {
        let results: Entity[] = [];
        _.each(value, v => {
          if (!(v instanceof Entity)) {
            assert.fail(`Cannot assign "${v}" to ${type}."${name}"`);
          } else if (v.type !== type) {
            assert.fail(`Cannot assign "${v.type}" to ${type}."${name}"`);
          } else {
            results.push(v);
          }
        });
        this._data[name] = results;
      } else if (value instanceof Entity) {
        this._data[name] = [ value ];
      } else {
        assert.fail(`Cannot assign "${value}" to ${type}."${name}"`);
      }
    } else {
      this._data[name] = value;
    }
  }

  public async save (fields: string[] = null): Promise<void> {
    this._manager.update(this, fields);
  }

  public getExistingFields (): string[] {
    return Object.keys(this._data);
  }

  public toString (): string {
    let shallowEntity = _.mapValues(this.schema.fields, (type, fieldName) => {
      let value = this.get(fieldName);
      if (!value) {
        return null;
      }
      if (type) {
        return _.map(<Entity[]>value, v => v.id);
      } else {
        return value;
      }
    });
    return JSON.stringify(shallowEntity);
  }
}
