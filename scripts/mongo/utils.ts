import * as _ from 'lodash';
import { expect } from 'chai';
import { MongoClient, DeleteWriteOpResultObject } from 'mongodb';
import { DataGraphUtils, IUpdate, IEnt, IEntInsert, Id } from '../../libs/dbLib2/DataGraph';

export async function connectMongo (url): Promise<MongoClient> {
  return await MongoClient.connect(url, { useNewUrlParser: true });
}

export async function readAllDocs (
  client: MongoClient,
  dbName: string,
  tableName: string,
): Promise<object[]> {
  const CHUNK_SIZE = 500;
  let db = client.db(dbName);

  let results = await DataGraphUtils.retryLoop(
    minId => {
      console.log(`[readAllDocs()] Reading ${dbName}.${tableName}, `
        + `minId=${minId}`);
      return db.collection(tableName).find({ _id: { $gt: minId }})
        .limit(CHUNK_SIZE).sort({ _id: 1 }).toArray()
    },
    out => {
      if (!out || out.length < CHUNK_SIZE) {
        return;
      }
      return out[out.length - 1]['_id'];
    },
    '',
  );

  return _.flatten(results);
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

export function getEntUpdateShallow (
  dst: IEnt,
  src: IEnt,
): IUpdate {
  expect(dst._id).to.eql(src._id);
  expect(dst._type).to.eql(src._type);

  let update: IUpdate = { _id: dst._id };
  let modified = false;
  _.each(_.keysIn(src), k => {
    if (_.isEqual(src[k], dst[k])) {
      return;
    }
    modified = true;
    update[k] = src[k];
  });

  return modified ? update : undefined;
}

export interface IEntSetDiff {
  insert: IEntInsert[],
  update: IUpdate[],
  delete: Id[],
}

export function getEntSetDiff (
  dst: IEnt[],
  src: IEnt[],
): IEntSetDiff {
  let dstMap = _.keyBy(dst, e => e._id);
  let idsToDelete = new Set(_.map(dst, e => e._id));
  let results: IEntSetDiff = {
    insert: [],
    update: [],
    delete: [],
  };
  _.each(src, s => {
    if (s._id in dstMap) {
      let d = dstMap[s._id];
      let update = getEntUpdateShallow(d, s);
      if (update) {
        results.update.push();
      }
      idsToDelete.delete(s._id);
    } else {
      results.insert.push(s);
    }
  });
  results.delete = Array.from(idsToDelete);

  return results;
}