import * as _ from 'lodash';
import * as airtable from 'airtable';
import config from '../../config/appConfig';

export class AirtableReader {
  private _db;
  private _cache = {};

  public constructor (dbId: string) {
    this._db = new airtable({ apiKey: config.airtableApiKey }).base(dbId);
  }

  /**
   * @returns a map from id to fields
   */
  public async readTable (tableName: string): Promise<{[id: string]: object}> {
    if (this._cache && this._cache[tableName]) {
      return this._cache[tableName];
    }

    let data = await new Promise<object[]>((resolve, reject) => {
      let results = [];
      this._db(tableName).select().eachPage(
        function (records, fetchNextPage) {
          results = _.concat(results, records);
          setTimeout(fetchNextPage, 200); // rate limit: 5 requests/sec
        },
        function done (err) {
          if (err) {
            reject(err);
          }
          resolve(results);
        },
      );
    });

    this._cache[tableName] =
      _.mapValues(_.keyBy(data, v => v['id']), v => v['fields']);

    return this._cache[tableName];
  }
}
