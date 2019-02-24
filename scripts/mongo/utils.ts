import * as _ from 'lodash';
import { MongoClient, DeleteWriteOpResultObject } from 'mongodb';
import { DataGraphUtils } from '../../libs/dbLib2/DataGraph';
import { Logger } from '../../libs/dbLib2/Logger';

export async function connectMongo (url): Promise<MongoClient> {
  return await MongoClient.connect(url, { useNewUrlParser: true });
}

let _cache = {};

export async function readAllDocs (
  client: MongoClient,
  dbName: string,
  tableName: string,
  limit?: number,
): Promise<object[]> {
  let cacheKey = `${dbName}.${tableName}`;
  if (_cache[cacheKey]) {
    return _cache[cacheKey];
  }

  const CHUNK_SIZE = 500;
  let db = client.db(dbName);

  let results = await DataGraphUtils.retryLoop(
    context => {
      Logger.log(
        `Reading ${dbName}.${tableName}, minId=${context.minId}`,
        '[readAllDocs()]',
      );
      let readCount = CHUNK_SIZE;
      if (context.limit && context.limit < readCount) {
        readCount = context.limit;
      }
      let query = {};
      if (context.minId) {
        query['_id'] = { $gt: context.minId };
      }
      return db.collection(tableName).find(query).limit(readCount)
        .sort({ _id: 1 }).toArray();
    },
    (context, out) => {
      if (!out || out.length < CHUNK_SIZE) {
        return;
      }
      context.minId = out[out.length - 1]['_id'];
      if (context.limit) {
        context.limit -= out.length;
      }
      return context;
    },
    { minId: undefined, limit: limit },
  );

  let ret = _.flatten(results);
  _cache[cacheKey] = ret;

  return ret;
}

export async function bulkDelete (
  client: MongoClient,
  dbName: string,
  tableName: string,
  ids: string[],
): Promise<DeleteWriteOpResultObject[]> {
  if (ids.length <= 0) {
    return;
  }
  return await DataGraphUtils.retryInChunks(
    items => client.db(dbName).collection(tableName)
      .deleteMany({ _id: { $in: items}}),
    ids,
  );
}
