import * as _ from 'lodash';
import { readAllDocs, connectMongo } from './utils';
import { MongoDbConfig } from '../../config/mongodb';

function group (config, docs: object[]): object {
  return _.reduce(
    docs,
    (groups, doc) => {
      let id = doc['_id'];
      let keys = _.map(config.paths, path => {
        let value = _.get(doc, path);
        if (value === undefined) {
          throw Error(`group key ${path} undefined in ${id}`);
        }
        return value;
      });
      let groupKey = _.join(keys, config.delimiter);
      let numKeys = _.keys(_.pickBy(doc, v => v !== undefined)).length;
      let record = { id: id, numKeys: numKeys };
      if (groupKey in groups) {
        groups[groupKey].push(record);
      } else {
        groups[groupKey] = [ record ];
      }
      return groups;
    },
    {},
  );
}

function dedupByNumKeys (groups): string[] {
  return _.flatten(_.map(groups, group => {
    let numKeysMax = -1;
    let numKeysMaxId;
    let toDelete = [];
    // delete all but the max numKey in each group
    _.each(group, record => {
      if (numKeysMax < record.numKeys) {
        numKeysMax = record.numKeys;
        if (numKeysMaxId) {
          toDelete.push(numKeysMaxId);
        }
        numKeysMaxId = record.id;
      } else {
        toDelete.push(record.id);
      }
    });
    if (_.includes(toDelete, numKeysMaxId)) {
      throw Error(`duplicate key ${numKeysMaxId}`);
    }
    return toDelete;
  }));
}

async function dedup (config) {
  // let connectionUrl = await MongoDbConfig.getUrl('remoteMongodb');
  let connectionUrl = await MongoDbConfig.getUrl();
  let client = await connectMongo(connectionUrl);
  let docs = await readAllDocs(client, config.dbName, config.tableName);
  console.log(`${docs.length} docs`);
  let groups = group(config.groupKey, docs);
  let deleteIds = dedupByNumKeys(groups);
  console.log(`deleting ids: ${deleteIds}`);
  // await bulkDelete(client, config.dbName, config.tableName, deleteIds);
  client.close();
}

dedup({
  'dbName': 'congress',
  'tableName': 'volunteer.bills',
  'groupKey': {
    'paths': [ 'congress', 'billType.code', 'billNumber' ],
    'delimiter': '-',
  }
});