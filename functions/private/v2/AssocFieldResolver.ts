import * as _ from 'lodash';
import { Type, IDataGraph, IEnt } from '../../../libs/dbLib2/DataGraph';

interface AssocFieldMap {
  [fieldName: string]: {
    assocType: Type,
    direction: 'forward' | 'backward',
  };
}

/**
 * An 'assoc field' of an entity is not a real field, but a virtual field
 * backed by assocs of a certain type. An assoc field typically contains
 * an array of associtated entity IDs.
 */
export class AssocFieldResolver {
  /**
   * Defines how to resolve assoc fields
   */
  protected static ASSOC_FIELD_MAPS: { [entType: number]: AssocFieldMap } = {
    [Type.Bill]: {
      sponsorIds: {
        assocType: Type.Sponsor,
        direction: 'backward',
      },
      cosponsorIds: {
        assocType: Type.Cosponsor,
        direction: 'backward',
      },
      tagIds: {
        assocType: Type.HasTag,
        direction: 'forward',
      },
    },
    [Type.Person]: {
      sponsoredBillIds: {
        assocType: Type.Sponsor,
        direction: 'forward',
      },
      cosponsoredBillIds: {
        assocType: Type.Cosponsor,
        direction: 'forward',
      },
    }
  };

  /**
   * @param ents Entities that may contain assoc fields to be resolved. If
   *  an assoc field is successfully resolved for an ent, a field will be
   *  added to the ent containing a list of associated entity IDs.
   * @param fields Field names that may include assoc field names. Non-assoc
   *  field names are ignored.
   */
  public static async resolve (
    g: IDataGraph,
    ents: IEnt[],
    fields: string[],
  ): Promise<IEnt[]> {
    let promises = [];
    let promiseKeys = [];

    _.each(ents, e => {
      if (e) {
        _.each(fields, f => {
          let assocFieldMap = AssocFieldResolver.ASSOC_FIELD_MAPS[e._type];
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