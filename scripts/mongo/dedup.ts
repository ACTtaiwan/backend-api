import * as _ from 'lodash';
import { MongoClient } from 'mongodb';

async function connect (config): Promise<MongoClient> {
  return await MongoClient.connect(
    config.dbUrl,
    { useNewUrlParser: true },
  );
}

async function getAllDocs (
  client: MongoClient,
  dbName: string,
  tableName: string,
): Promise<object[]> {
  const CHUNK_SIZE = 950;
  const NUM_RETRIES = 3;
  const RETRY_DELAY = 500; // ms

  let db = client.db(dbName);
  let results = [];
  let offset = 0;
  let retriesLeft = NUM_RETRIES;
  while (true) {
    try {
      console.log(`Reading ${CHUNK_SIZE} (offset=${offset})`);
      let chunk = await db.collection(tableName).find()
        .skip(offset).limit(CHUNK_SIZE).toArray();
      if (chunk.length > 0) {
        results.push(chunk);
        offset += chunk.length;
      } else {
        console.log(`Done`);
        return _.flatten(results);
      }
      retriesLeft = 3;
    } catch (err) {
      console.log(err);
      console.log(`retries left: ${retriesLeft--}`);
      if (retriesLeft <= 0) {
        throw Error('Cannot get data after all retries');
      }
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
    }
  }
}

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

function dedupByNumKeys (groups): object[] {
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
    return _.map(toDelete, id => ({ deleteOne: { filter: { _id: id }}}));
  }));
}

function dedupByNumKeys2 (groups): string[] {
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
    return toDelete;
  }));
}

async function bulkWrite (
  client: MongoClient,
  dbName: string,
  tableName: string,
  writes: object[]
): Promise<void> {
  if (writes.length <= 0) {
    return;
  }
  const CHUNK_SIZE = 20;
  const NUM_RETRIES = 3;
  const RETRY_DELAY = 1000; // ms

  let chunks = _.chunk(writes, CHUNK_SIZE);
  let i = 0;
  let retriesLeft = NUM_RETRIES;
  while (true) {
    try {
      console.log(`Bulk-write chunk ${i + 1} of ${chunks.length}`);
      let results = await client.db(dbName).collection(tableName)
        .bulkWrite(chunks[i]);
      retriesLeft = NUM_RETRIES;
      ++i;
      if (i >= chunks.length) {
        console.log(`Done`);
        return;
      }
    } catch (err) {
      console.log(err);
      console.log(`retries left: ${retriesLeft--}`);
      if (retriesLeft <= 0) {
        throw Error('Cannot bulk write after all retries');
      }
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
    }
  }
}

async function bulkDelete (
  client: MongoClient,
  dbName: string,
  tableName: string,
  ids: string[],
): Promise<void> {
  if (ids.length <= 0) {
    return;
  }
  const CHUNK_SIZE = 100;
  const NUM_RETRIES = 3;
  const RETRY_DELAY = 500; // ms

  let chunks = _.chunk(ids, CHUNK_SIZE);
  let i = 0;
  let retriesLeft = NUM_RETRIES;
  while (true) {
    try {
      console.log(`Delete chunk ${i + 1} of ${chunks.length}`);
      let results = await client.db(dbName).collection(tableName)
        .deleteMany({ _id: { $in: chunks[i] }});
      retriesLeft = NUM_RETRIES;
      ++i;
      if (i >= chunks.length) {
        console.log(`Done`);
        return;
      }
    } catch (err) {
      console.log(err);
      console.log(`retries left: ${retriesLeft--}`);
      if (retriesLeft <= 0) {
        throw Error('Cannot bulk write after all retries');
      }
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
    }
  }
}

async function dedup (config) {
  let client = await connect(config);
  let docs = await getAllDocs(client, config.dbName, config.tableName);
  let groups = group(config.groupKey, docs);
  // let writes = dedupByNumKeys(groups);
  // await bulkWrite(client, config.dbName, config.tableName, writes);
  let deleteIds = dedupByNumKeys2(groups);
  await bulkDelete(client, config.dbName, config.tableName, deleteIds);
  client.close();
}

dedup({
  // 'dbUrl': 'mongodb://localhost:27017',
  'dbUrl': 'mongodb://uswatch:tBc7XsIqwMUnovS49at1U4rDV4C8HHcFaNNRmN0eQwrvNWiNWy2zvVN6nqi9aF85U4FTYaJSKQEBYRIE1uMRPg%3D%3D@uswatch.documents.azure.com:10255/congress?ssl=true&replicaSet=globaldb',
  'dbName': 'congress',
  'tableName': 'volunteer.bills',
  'groupKey': {
    'paths': [ 'congress', 'billType.code', 'billNumber' ],
    'delimiter': '-',
  }
});