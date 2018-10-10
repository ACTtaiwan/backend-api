import * as _ from 'lodash';
import * as inquirer from 'inquirer';
import { IEnt, IAssoc, IDataGraph, Type, DataGraphUtils, IAssocInsert, IEntInsert, IUpdate, Id, isIEntInsert, isIAssocInsert } from './DataGraph';
import { Logger } from './Logger';

interface DataCache {
  [type: string]: {
    hasAll: boolean,
    data: {
      [id: string]: IEnt | IAssoc, // should cache complete fields
    }
  }
}

export class DataManager {
  protected _logger: Logger = new Logger('DataManager');
  protected _cache: DataCache = {};

  public constructor (
    protected _g: IDataGraph,
  ) {}

  /**
   * Load all entities (or assocs) of a type.
   */
  public async loadAll (type: Type): Promise<(IEnt | IAssoc)[]> {
    let ret: (IEnt | IAssoc)[];
    if (Type[type] in this._cache) {
      if (this._cache[Type[type]].hasAll) {
        ret = _.values(this._cache[Type[type]].data);
      }
    }
    if (!ret) {
      // cache miss
      if (DataGraphUtils.typeIsEnt(type)) {
        ret = await this._g.findEntities({ _type: type });
      } else {
        ret = await this._g.findAssocs({ _type: type });
      }
    }
    return ret;
  }

  /**
   * Compare src and dst ents, and generate appropriate IUpdate object
   * that will mutate dst to become the same as src.
   * @returns undefined if input is identical to this object
   */
  protected static _compareAndPrepShallowUpdate<T extends IEnt | IAssoc> (
    dst: T,
    src: T,
  ): IUpdate {
    if (dst._type !== src._type) {
      throw Error(`[DataGraphUtils.compareAndPrepShallowUpdate] Type mismatch: `
        + `${dst._type} !== ${src._type}`);
    }
    if (src._id && src._id !== dst._id) {
      // if _id exists in src, it must match dst's id
      throw Error(`[DataGraphUtils.compareAndPrepShallowUpdate] ID mismatch: `
        + `${src._id} !== ${dst._id}`);
    }
    let update: IUpdate = { _id: dst._id };
    let modified = false;
    _.each(_.keysIn(src), k => {
      if (k === '_id') {
        return; // allow src to not provide _id
      }
      if (_.isEqual(src[k], dst[k])) {
        return;
      }
      modified = true;
      update[k] = src[k];
    });

    return modified ? update : undefined;
  }

  /**
   * Ask for user confirmation in CLI
   * @param msg
   */
  protected static async _cliConfirm (msg: string = 'Proceed?')
  : Promise<boolean> {
    let response = await inquirer.prompt({
      name: 'confirm',
      type: 'confirm',
      message: msg,
      default: true,
    });
    if (!response) {
      throw Error(`[DataGraphUtils.cliConfirm()] Could not get response`);
    }
    return response['confirm'];
  }

  /**
   * Import a dataset into the underlying DataGraph. The source dataset is
   * divided into three sets: update, insert, and delete sets, depending on
   * whether a match could be found between the source and the
   * destination dataset (DagaGraph). A match is determined by whether two
   * records have the same values in all of their fields specified by
   * joinFields. The three sets will be used to perform update, insert,
   * and delete operations, respectively, into the entity or assoc collection,
   * depending on type.
   * @param type could be an entity type or an assoc type
   * @param data source dataset
   * @param joinFields
   * @param cliConfirmation
   */
  public async importDataset (
    type: Type,
    data: (IEnt | IAssoc)[],
    joinFields: string[],
    cliConfirmation: boolean = false,
  ) {
    let typeIsEnt = DataGraphUtils.typeIsEnt(type);
    let joinKey = d => _.join(_.map(joinFields, jf => {
      if (d[jf] === undefined) {
        throw Error(`[DataManager.importDataset()] Join field ${jf} `
          + `cannot be undefined in ${d}`);
      }
      return JSON.stringify(d[jf]);
    }), ':');
    // validate data
    _.each(data, src => {
      if (!src['_type'] || src['_type'] !== type) {
        throw Error(`[DataManager.importDataset()] Input data type mismatch: `
          + `${src['_type']} !== ${type}`);
      }
    });
    // load all ents of type
    let targetDataset = await this.loadAll(type);
    let targetDatasetByJoinKey = _.keyBy<IEnt | IAssoc>(targetDataset, joinKey);
    // compare and divide the source data into three sets
    let insertEnts: IEntInsert[] = [];
    let insertAssocs: IAssocInsert[] = [];
    let updates: IUpdate[] = [];
    let deletes: Set<Id> = new Set(_.map(targetDataset, e => e._id));
    _.each(data, src => {
      let key = joinKey(src);
      if (key in targetDatasetByJoinKey) {
        let dst = targetDatasetByJoinKey[key];
        let update = DataManager._compareAndPrepShallowUpdate(dst, src);
        if (update) {
          if ('_type' in update || '_id1' in update || '_id2' in update) {
            throw Error(`[DataManager.importDataset()] Cannot update _type, `
              + `_id1, or _id2 field: update=${update}`);
          }
          updates.push(update);
        }
        deletes.delete(dst._id);
      } else {
        let insert = _.assign(_.pickBy(src), { _type: type });
        if (typeIsEnt && isIEntInsert(insert)) {
          insertEnts.push(insert);
        } else if (!typeIsEnt && isIAssocInsert(insert)) {
          insertAssocs.push(insert);
        } else {
          throw Error(`[DataManager.importDataset()] Data object not valid `
            + `for insertion: type=${type}, insert=${insert}`);
        }
      }
    });
    // show results
    this._logger.log(`${Type[type]} migration plan:`);
    this._logger.log({
      inserts: typeIsEnt ? insertEnts : insertAssocs,
      updates: updates,
      deletes: deletes,
    });
    // commit changes
    if (cliConfirmation) {
      let proceed = await DataManager._cliConfirm();
      if (!proceed) {
        this._logger.log('Abort');
        return;
      }
    }
    if (insertEnts.length > 0) {
      await this._g.insertEntities(insertEnts);
    }
    if (insertAssocs.length > 0) {
      await this._g.insertAssocs(insertAssocs);
    }
    if (updates.length > 0) {
      if (typeIsEnt) {
        await this._g.updateEntities(updates);
      } else {
        await this._g.updateAssocs(updates);
      }
    }
    if (deletes.size > 0) {
      if (typeIsEnt) {
        await this._g.deleteEntities(Array.from(deletes));
      } else {
        await this._g.deleteAssocs(Array.from(deletes));
      }
    }
  }
}