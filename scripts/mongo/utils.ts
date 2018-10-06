import * as _ from 'lodash';
import { expect } from 'chai';
import * as inquirer from 'inquirer';
import { MongoClient, DeleteWriteOpResultObject } from 'mongodb';
import { DataGraphUtils, IUpdate, IEnt, IEntInsert, Id, IAssocInsert, IAssoc } from '../../libs/dbLib2/DataGraph';
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

export function getDocUpdateShallow<T extends IEnt | IAssoc> (
  dst: T,
  src: T,
): IUpdate {
  let update: IUpdate = { _id: dst._id };
  let modified = false;
  _.each(_.keysIn(src), k => {
    if (k === '_id') {
      return;
    }
    if (_.isEqual(src[k], dst[k])) {
      return;
    }
    modified = true;
    update[k] = src[k];
  });

  return modified ? update : undefined;
}

export interface IDocSetDiff<T extends IEnt | IAssoc> {
  insert: T[],
  update: IUpdate[],
  delete: Id[],
}

/**
 * Compare objects in dst and src, and returns the changes, in the form
 * of insert, update, and delete, to be applied to the dst set, in order to
 * make dst equal src.
 *
 * @param joinFields When comparing objects in dst with those in src, if two
 * objects have the same values in the fields specified by this param,
 * they are considered equal.
 */
export function getDocSetDiff<T extends (IEnt | IAssoc)> (
  dst: T[],
  src: T[],
  joinFields: string[],
): IDocSetDiff<T> {
  let joinKey = (d: T) => _.join(_.map(joinFields, jf => {
    if (d[jf] === undefined) {
      throw Error(`Join field ${jf} cannot be undefined in ${d}`);
    }
    return d[jf];
  }), ':');
  let dstMap = _.keyBy(dst, joinKey);
  let dstIdsToDelete = new Set(_.map(dst, e => e._id));
  let results: IDocSetDiff<T> = {
    insert: [],
    update: [],
    delete: [],
  };
  _.each(src, s => {
    let sKey = joinKey(s);
    if (sKey in dstMap) {
      let d = dstMap[sKey];
      _.each(joinFields, jf => {
        // sanity
        expect(d[jf]).to.eql(s[jf]);
      });
      let update = getDocUpdateShallow(d, s);
      if (update) {
        results.update.push(update);
      }
      dstIdsToDelete.delete(d._id);
    } else {
      let joinValues = _.mapValues(_.keyBy(joinFields), jf => s[jf]);
      results.insert.push(<T>_.merge(_.pickBy(s), joinValues));
    }
  });
  results.delete = Array.from(dstIdsToDelete);

  return results;
}