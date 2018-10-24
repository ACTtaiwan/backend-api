import * as _ from 'lodash';
import { DataGraph, Type, IEnt, IDataGraph } from '../../../libs/dbLib2/DataGraph';
import { Id } from '../../../libs/dbLib2/types';
import { translateTypeEnum } from './handlers';

interface AssocFieldMap {
  [fieldName: string]: {
    assocType: Type,
    direction: 'forward' | 'backward',
  }
}

let ASSOC_FIELD_MAPS: { [entType: number]: AssocFieldMap } = {
  [Type.Bill]: {
    sponsors: {
      assocType: Type.Sponsor,
      direction: 'backward',
    },
    cosponsors: {
      assocType: Type.Cosponsor,
      direction: 'backward',
    },
    tags: {
      assocType: Type.HasTag,
      direction: 'forward',
    },
  }
};

export class IdHandler {
  public static async run (
    ids: Id[],
    fields: string[],
  ): Promise<any> {
    let g = await DataGraph.getDefault();
    let ents = await Promise.all(
      _.map(ids, async id => g.loadEntity(id, fields))
    );
    ents = await IdHandler.resolveAssocFields(g, ents, fields);

    return _.map(ents, translateTypeEnum);
  }

  /**
   * Some of `fields` may refer to an assoc, instead of an entity field. All
   * field names that are mapped to assocs are defined in ASSOC_FIELD_MAPS.
   * @param ents
   * @param fields
   */
  public static async resolveAssocFields (
    g: IDataGraph,
    ents: IEnt[],
    fields: string[],
  ): Promise<IEnt[]> {
    let promises = [];
    let promiseKeys = [];

    _.each(ents, e => {
      if (e) {
        _.each(fields, f => {
          let assocFieldMap = ASSOC_FIELD_MAPS[e._type];
          if (assocFieldMap && assocFieldMap[f]) {
            promises.push(g.listAssociatedEntityIds(
              e._id,
              assocFieldMap[f].assocType,
              assocFieldMap[f].direction,
            ));
            promiseKeys.push(`${e._id}.${f}`);
          }
        });
      }
    });

    let promiseResults = await Promise.all(promises);
    let resultMap = {};
    _.each(promiseResults, (r, i) => {
      resultMap[promiseKeys[i]] = r;
    });

    ents = _.map(ents, e => {
      if (e) {
        _.each(fields, f => {
          let k = `${e._id}.${f}`;
          if (k in resultMap) {
            e[f] = resultMap[k];
          }
        });
      }
      return e;
    });

    return ents;
  }
}