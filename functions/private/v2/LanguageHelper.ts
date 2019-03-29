import * as _ from 'lodash';
import { IEnt, IAssoc } from '../../../libs/dbLib2';

export class LanguageHelper {
  protected static ELIGIBLE_FIELDS = {
    title: new Set(['zh']),
    summary: new Set(['zh']),
    firstName: new Set(['zh']),
    lastName: new Set(['zh']),
    name: new Set(['zh']),
  };

  /**
   * Scan through fields to find eligible ones for the specified language.
   * Add a new field whose name is the original field name appended with
   * underscore and language code (typically two letters).
   * For example: lastName -> lastName_zh
   */
  public static augmentFields (fields: string[], lang?: string): string[] {
    let extraFields = _.filter(_.map(fields, f => {
      let eligibleLangSet = LanguageHelper.ELIGIBLE_FIELDS[f];
      if (eligibleLangSet && eligibleLangSet.has(lang)) {
        return `${f}_${lang}`;
      }
    }));

    return _.union(fields, extraFields);
  }

  /**
   * Scan through the object field names, and find language-specific fields
   * (i.e., field name having langauge postfix). If the base field (without the
   * language postfix) exists, override its value with the language-specific
   * value, and delete the langauge-specific field from the object.
   */
  public static consolidateFields<T = IEnt | IAssoc> (
    objects: T[],
    lang?: string,
  ): T[] {
    if (lang === undefined || lang.length <= 0) {
      return objects;
    }
    let fieldPostfix = `_${lang}`;
    return _.map(objects, o => {
      let updatingFields = {};
      let deletingFields = [];
      _.forOwn(o, (val, field) => {
        if (!_.endsWith(field, fieldPostfix)) {
          return;
        }
        // for all field names ending with _zh
        let baseField = field.substring(
          0,
          field.length - fieldPostfix.length,
        );
        if (baseField.length <= 0 || o[baseField] === undefined) {
          return;
        }
        updatingFields[baseField] = val;
        deletingFields.push(field);
      });
      _.forOwn(updatingFields, (v, f) => {
        o[f] = v;
      });
      _.each(deletingFields, f => {
        delete o[f];
      });
      return o;
    });
  }
}