import * as _ from 'lodash';
import * as assert from 'assert';

import { Manager, EntityType, Schema, SCHEMAS } from './';

export class Entity {
  protected _data: { [key: string]: any } = {};

  protected constructor (
    protected _manager: Manager,
    public readonly type: EntityType,
    public readonly id: string,
    data: { [key: string]: any },
  ) {
    this._data = _.pickBy(
      data,
      (_value, key) => key in this.schema.fields,
    );
  }

  public static _instantiate (
    manager: Manager,
    type: EntityType,
    id: string,
    data: { [key: string]: any },
  ): Entity {
    console.log(`instantiate entity ${type} ${id}`);
    return new Entity(manager, type, id, data);
  }

  public async _resolveReferences (): Promise<Entity> {
    await Promise.all(_.chain(this.schema.fields)
      .pickBy((type, _fieldName) => type !== null)
      .map(async (type, fieldName) => {
        this._data[fieldName] = await Promise.all(
          _.map(this._data[fieldName], async id =>
            await this._manager.find(type, id),
          ),
        );
      })
      .value(),
    );
    return this;
  }

  public get schema (): Schema {
    let schema = SCHEMAS[this.type];
    assert.ok(schema, `Cannot find schema for type ${this.type}`);
    return schema;
  }

  public get (name: string): any {
    assert.ok(name in this.schema.fields, `Field does not exist: ${name}`);
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
}
