import * as _ from 'lodash';
import { Type } from '../../../libs/dbLib2';
import { RequestHandlerBase } from './RequestHandlerBase';
import { RequestParams } from './RequestParams';

export type Lang = 'en' | 'zh';
export function toLang (lang: string): Lang {
  if (lang && lang.startsWith('en')) {
    return 'en';
  }
  if (lang && lang.startsWith('zh')) {
    return 'zh';
  }
}

type LangField = { entType: Type; lang: Lang };
type LangFields = { [field: string]: LangField[] };

export class LanguageProcessor<T> extends RequestHandlerBase<T> {
  private static readonly LANG_FIELDS: LangFields = {
    title: [
      {
        entType: Type.Bill,
        lang: 'zh',
      },
    ],
    summary: [
      {
        entType: Type.Bill,
        lang: 'zh',
      },
    ],
    firstName: [
      {
        entType: Type.Person,
        lang: 'zh',
      },
    ],
    lastName: [
      {
        entType: Type.Person,
        lang: 'zh',
      },
    ],
    name: [
      {
        entType: Type.Tag,
        lang: 'zh',
      },
    ],
  };

  private _addedFields: string[];

  /**
   * Scan through fields to find eligible ones for the specified language.
   * Add a new field whose name is the original field name appended with
   * underscore and language code (typically two letters).
   * For example: lastName -> lastName_zh
   */
  protected async preProcess (params: RequestParams): Promise<boolean> {
    let lang = toLang(params.getFirstString('lang'));
    if (!lang) {
      return false;
    }

    this._addedFields = [];
    let fieldValues = params.get('field');
    if (!fieldValues) {
      return false;
    }
    let fieldNames = _.intersection(
      fieldValues.getAllValues(),
      _.keys(LanguageProcessor.LANG_FIELDS)
    );
    _.each(fieldNames, fieldName => {
      let langField = _.filter(
        LanguageProcessor.LANG_FIELDS[fieldName],
        lf => lf.lang === lang
      );
      if (langField.length > 0) {
        let newFieldName = `${fieldName}_${lang}`;
        if (!fieldValues.contains(newFieldName)) {
          this._addedFields.push(newFieldName);
          fieldValues.add(newFieldName, fieldValues.getContext(fieldName));
        }
      }
    });

    if (this._addedFields.length > 0) {
      return true;
    }
    return false;
  }

  /**
   * Write language-specific field value to the generic field, e.g.,
   * if the preProcess stage requested 'summary_zh',
   * write the value to 'summary'.
   */
  protected async postProcess (_p: RequestParams, results: T[]): Promise<T[]> {
    return _.map(results, ent => {
      _.each(this._addedFields, addedField => {
        let toks = _.split(addedField, '_');
        if (toks.length < 2) {
          return;
        }
        let originalFieldName = toks[0];
        let lang = toks[1];
        // check ent type
        let langField = _.filter(
          LanguageProcessor.LANG_FIELDS[originalFieldName],
          lf => {
            if (lf.lang !== lang) {
              return false;
            }
            if ('_type' in ent && lf.entType !== ent['_type']) {
              return false;
            }
            return true;
          }
        );
        if (langField.length > 0) {
          ent[originalFieldName] = ent[addedField];
          delete ent[addedField];
        }
      });
      return ent;
    });
  }
}
