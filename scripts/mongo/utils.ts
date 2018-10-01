import * as _ from 'lodash';
import { expect } from 'chai';
import * as inquirer from 'inquirer';
import { MongoClient, DeleteWriteOpResultObject } from 'mongodb';
import { DataGraphUtils, IUpdate, IEnt, IEntInsert, Id } from '../../libs/dbLib2/DataGraph';
import { Logger } from '../../libs/dbLib2/Logger';

export async function connectMongo (url): Promise<MongoClient> {
  return await MongoClient.connect(url, { useNewUrlParser: true });
}

export async function readAllDocs (
  client: MongoClient,
  dbName: string,
  tableName: string,
  limit?: number,
): Promise<object[]> {
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
      return db.collection(tableName).find({ _id: { $gt: context.minId }})
        .limit(readCount).sort({ _id: 1 }).toArray()
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
    { minId: '', limit: limit },
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

export async function cliConfirm (msg: string = 'Proceed?'): Promise<boolean> {
  let response = await inquirer.prompt({
    name: 'confirm',
    type: 'confirm',
    message: msg,
    default: true,
  });
  if (!response) {
    return false;
  }
  return response['confirm'];
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
    if (_.isEqualWith(src[k], dst[k])) {
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
        results.update.push(update);
      }
      idsToDelete.delete(s._id);
    } else {
      results.insert.push(s);
    }
  });
  results.delete = Array.from(idsToDelete);

  return results;
}