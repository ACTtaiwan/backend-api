import * as _ from 'lodash';
import {
  Type,
  IEnt,
  DataGraph,
  AssocDirection,
  IAssociatedEntIds,
  IDataGraph,
} from '../../../libs/dbLib2/DataGraph';
import { RequestHandlerBase } from './RequestHandlerBase';
import { RequestParams } from './RequestParams';

interface AssocField {
  entType: Type;
  assocType: Type;
  direction: AssocDirection;
  subFields: string[];
}

/**
 * An 'assoc field' of an entity is not a real field, but a virtual field
 * backed by assocs of a certain type. An assoc field typically contains
 * an array of associtated entity IDs.
 */
export class AssocFieldsProcessor extends RequestHandlerBase<IEnt> {
  /**
   * Assoc fields: virtual fields representing the associated ent IDs
   */
  private static readonly ALL_ASSOC_FIELDS: { [field: string]: AssocField } = {
    sponsorIds: {
      entType: Type.Bill,
      assocType: Type.Sponsor,
      direction: 'backward',
      subFields: [],
    },
    cosponsorIds: {
      entType: Type.Bill,
      assocType: Type.Cosponsor,
      direction: 'backward',
      subFields: [],
    },
    tagIds: {
      entType: Type.Bill,
      assocType: Type.HasTag,
      direction: 'forward',
      subFields: [],
    },
    sponsors: {
      entType: Type.Bill,
      assocType: Type.Sponsor,
      direction: 'backward',
      subFields: [],
    },
    cosponsors: {
      entType: Type.Bill,
      assocType: Type.Cosponsor,
      direction: 'backward',
      subFields: ['date'],
    },
    tags: {
      entType: Type.Bill,
      assocType: Type.HasTag,
      direction: 'forward',
      subFields: [],
    },
    sponsoredBillIds: {
      entType: Type.Person,
      assocType: Type.Sponsor,
      direction: 'forward',
      subFields: [],
    },
    cosponsoredBillIds: {
      entType: Type.Person,
      assocType: Type.Cosponsor,
      direction: 'forward',
      subFields: [],
    },
    sponsoredBills: {
      entType: Type.Person,
      assocType: Type.Sponsor,
      direction: 'forward',
      subFields: [],
    },
    cosponsoredBills: {
      entType: Type.Person,
      assocType: Type.Cosponsor,
      direction: 'forward',
      subFields: ['date'],
    },
  };

  private _assocFields: { [field: string]: AssocField };

  public constructor (
    private _g: IDataGraph,
    innerHandler: RequestHandlerBase<IEnt>
  ) {
    super(innerHandler);
  }

  /**
   * Remove assoc fields from params['field'] and store it in this._assocFields
   */
  protected async preProcess (params: RequestParams): Promise<boolean> {
    let fieldValues = params.get('field');
    if (!fieldValues) {
      return false;
    }
    let fieldNames = fieldValues.getAllValues();

    let allAssocFieldNames = new Set(
      _.keys(AssocFieldsProcessor.ALL_ASSOC_FIELDS)
    );

    this._assocFields = {};
    _.each(fieldNames, fieldName => {
      if (!allAssocFieldNames.has(fieldName)) {
        return;
      }
      let context = fieldValues.remove(fieldName);
      let assocField = _.clone(
        AssocFieldsProcessor.ALL_ASSOC_FIELDS[fieldName]
      );
      assocField.subFields = _.intersection(
        assocField.subFields,
        context.getRaw()
      );
      this._assocFields[fieldName] = assocField;
    });

    if (_.size(this._assocFields) > 0) {
      return true;
    }
    return false;
  }

  /**
   * Resolve assoc fields in this._assocFields and populate the results to ents
   */
  protected async postProcess (
    _params: RequestParams,
    results: IEnt[]
  ): Promise<IEnt[]> {
    let promises: { [key: string]: Promise<IAssociatedEntIds[]> } = {};
    let getPromiseKey = (e: IEnt, field: string) => {
      return `${e._id}.${field}`;
    };

    _.each(results, ent => {
      if (!ent) {
        return;
      }
      _.each(this._assocFields, (af, fieldName) => {
        if (af.entType !== ent._type) {
          return;
        }
        let promise = this._g.listAssociatedEntityIds(
          ent._id,
          af.assocType,
          af.direction,
          _.fromPairs(_.map(af.subFields, sf => [sf, true]))
        );
        promises[getPromiseKey(ent, fieldName)] = promise;
      });
    });

    let resolved = _.fromPairs(
      _.zip(_.keys(promises), await Promise.all(_.values(promises)))
    );

    return _.map(results, ent => {
      if (ent) {
        _.each(this._assocFields, (af, fieldName) => {
          let res = resolved[getPromiseKey(ent, fieldName)];
          if (res) {
            ent[fieldName] = res;
            if (_.endsWith(fieldName, 'Ids')) {
              // TODO: remove fields ending with 'Ids'
              ent[fieldName] = _.map(ent[fieldName], v => v['_id']);
            }
          }
        });
      }
      return ent;
    });
  }
}
