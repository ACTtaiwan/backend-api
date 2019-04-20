import * as _ from 'lodash';
import { Type, IDataGraph, IEnt } from '../../../libs/dbLib2/DataGraph';

interface AssocFieldMap {
  [fieldName: string]: {
    assocType: Type,
    direction: 'forward' | 'backward',
    allowedSubfields?: string[],
  };
}

interface AssocFieldRequest {
  field: string;
  subFields?: string[];
}

/**
 * An 'assoc field' of an entity is not a real field, but a virtual field
 * backed by assocs of a certain type. An assoc field typically contains
 * an array of associtated entity IDs.
 */
export class AssocFieldResolver {
  /**
   * Defines how to resolve assoc fields
   * TODO: remove
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
      sponsors: {
        assocType: Type.Sponsor,
        direction: 'backward',
      },
      cosponsors: {
        assocType: Type.Cosponsor,
        direction: 'backward',
        allowedSubfields: ['date'],
      },
      tags: {
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
      sponsoredBills: {
        assocType: Type.Sponsor,
        direction: 'forward',
      },
      cosponsoredBills: {
        assocType: Type.Cosponsor,
        direction: 'forward',
        allowedSubfields: ['date'],
      },
    }
  };

  /**
   * @param fieldString Example: virtual_field#assoc_field1,assoc_field2,...
   */
  protected static parseAssocFieldString (fieldString: string)
  : AssocFieldRequest {
    let toks = _.split(fieldString, '#');
    let res: AssocFieldRequest = {
      field: toks[0],
    };
    if (toks.length > 1) {
      res.subFields = _.split(toks[1], ',');
    }
    return res;
  }

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
          let fieldReq = AssocFieldResolver.parseAssocFieldString(f);
          if (assocFieldMap && assocFieldMap[fieldReq.field]) {
            let assocFieldMetadata = assocFieldMap[fieldReq.field];
            let subfields = _.intersection(
              assocFieldMetadata.allowedSubfields,
              fieldReq.subFields,
            );
            promises.push(g.listAssociatedEntityIds(
              e._id,
              assocFieldMetadata.assocType,
              assocFieldMetadata.direction,
              subfields,
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
            // TODO: remove
            if (_.endsWith(f, 'Ids')) {
              e[f] = _.map(e[f], obj => obj['_id']);
            }
          }
        });
      }
      return e;
    });

    return ents;
  }
}