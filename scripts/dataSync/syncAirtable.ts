import * as _ from 'lodash';
import * as mongoDbLib from '../../libs/mongodbLib';
import { MongoDbConfig } from '../../config/mongodb';
import * as airtable from '../../libs/airtable';
import { BillTypeCode, ChamberType } from '../../libs/congressGov/CongressGovModels';
import Utility from '../../libs/utils/Utility';
import { MongoDBManager } from '../../libs/mongodbLib';
import { logger } from '../../libs/utils/Logger';

type Entity = {[key: string]: any};

interface Table<E extends Entity = Entity> {
  connect: (config: TableConfig) => Promise<void>;
  fetch: (fields: string[]) => Promise<E[]>;
  insert: (entities: E[]) => Promise<void>;
  update: (entities: E[]) => Promise<void>;
  getEntityMatchKey: (E) => string;
  // TODO Support deletion
}

abstract class MongoTable implements Table {
  protected _manager: MongoDBManager;
  protected _handle: mongoDbLib.MongoDBTable;
  protected _mockWrite: boolean;
  public constructor (protected _logPrefix: string = '') {}
  protected log (message: string) {
    logger.log(this._logPrefix + message);
  }
  public async connect (config: MongoTableConfig): Promise<void> {
    this._manager = await mongoDbLib.MongoDBManager.instance;
    this._handle = this._manager.getTable(config.tableName);
    this._mockWrite = config.mockWrite;
  }
  public async fetch (fields: string[]): Promise<Entity[]> {
    return this._handle.queryItems({}, fields);
  }
  public async insert (entities: Entity[]): Promise<void> {
    if (!entities || entities.length === 0) {
      return;
    }
    _.each(entities, e => {
      this.log(`insertPlan ${JSON.stringify(e)}`);
    });
    if (!this._mockWrite) {
      let result = await this._handle.addItems(entities);
      this.log(`inserted: count=${result.result.n}/${entities.length}`);
    }
  }
  public async update (entities: Entity[]): Promise<void> {
    if (!entities || entities.length === 0) {
      return;
    }
    _.each(entities, e => {
      this.log(`updatePlan ${JSON.stringify(e['id'])} ${JSON.stringify(e)}`);
    });
    if (!this._mockWrite) {
      await Promise.all(_.map(entities, async ent => {
        let result = await this._handle.updateItemByObjectId(ent['id'], ent)
          .catch(e => {
            console.error(e);
            return {result: {}};
          }
        );
        this.log(`updated: ${ent['id']} ${result.result.ok ? 'ok' : 'failed'}`);
      }));
    }
  }
  public abstract getEntityMatchKey (e: Entity): string;
}

class MongoBillsTable extends MongoTable {
  public getEntityMatchKey (e: Entity): string {
    if (!e['congress'] || !e['billType'] || !e['billType']['code']
        || !e['billNumber']) {
      return;
    }
    return _.join([e['congress'], e['billType']['code'], e['billNumber']]);
  }
}

class MongoTagsTable extends MongoTable {
  public getEntityMatchKey (e: Entity): string {
    return e['tag'];
  }
}

class MongoArticleSnippetsTable extends MongoTable {
  public getEntityMatchKey (e: Entity): string {
    return e['readableId'];
  }
}

abstract class AirtableTable implements Table {
  protected _handle: airtable.Manager;
  protected _entityType: airtable.EntityType;
  public async connect (config: AirtableTableConfig): Promise<void> {
    this._handle = await airtable.Manager.new(config.dbId);
    this._entityType = config.entityType;
  }
  public async fetch (fields: string[]): Promise<Entity[]> {
    let ents = await this._handle.list(this._entityType, fields);
    return _.map(ents, ent => ent.getRawData());
  }
  public async insert (_: Entity[]): Promise<void> {
    throw new Error('Sync into Airtable is not supported');
  }
  public async update (_: Entity[]): Promise<void> {
    throw new Error('Sync into Airtable is not supported');
  }
  public abstract getEntityMatchKey (e: Entity): string;
}

class AirtableBillsTable extends AirtableTable {
  public getEntityMatchKey (e: Entity): string {
    if (!e['congress'] || !e['bill type'] || !e['bill type'][0]
        || !e['bill type'][0]['Code'] || !e['bill number']) {
      return;
    }
    return _.join([
      e['congress'],
      SyncUtils.billTypeDisplayToCode(e['bill type'][0]['Code']),
      e['bill number'],
    ]);
  }
}

class AirtableTagsTable extends AirtableTable {
  public getEntityMatchKey (e: Entity): string {
    return e['Name'];
  }
}

class AirtableArticleSnippetsTable extends AirtableTable {
  public getEntityMatchKey (e: Entity): string {
    return e['Readable ID'];
  }
}

interface SyncSimpleFieldConfig {
  sourceField: string;
  transform: (source: any) => any;
}

interface SyncStructFieldConfig {
  sourceField: string;
  sync: (
    config: SyncEntityConfig,
    source: Entity | Entity[],
    target: any | any[],
  ) => [any, any]; // result, diff
  config: SyncEntityConfig;
}

interface SyncEntityConfig {
  [targetField: string]: string | SyncSimpleFieldConfig | SyncStructFieldConfig;
}

interface TableConfig {}

interface AirtableTableConfig extends TableConfig {
  dbId: string;
  entityType: airtable.EntityType;
}

interface MongoTableConfig extends TableConfig {
  tableName: string;
  mockWrite?: boolean;
}

interface SyncConfig {
  sourceTable: TableConfig;
  targetTable: TableConfig;
  syncEntityConfig: SyncEntityConfig;
}

class Sync {
  public constructor (
    protected _config: SyncConfig,
    protected _sourceTable: Table,
    protected _targetTable: Table,
    protected _logPrefix: string = '',
  ) {}

  protected log (message: string) {
    logger.log(this._logPrefix + message);
  }

  private _getTargetFields (): string[] {
    return _.map(this._config.syncEntityConfig, (_, field) => field);
  }

  private _getSourceFields (): string[] {
    // TODO extract referenced source fields from config
    return;
  }

  public async sync (): Promise<void> {
    // 1. connect source and target tables
    await Promise.all([
      this._sourceTable.connect(this._config.sourceTable),
      this._targetTable.connect(this._config.targetTable),
    ]);
    // 2. fetch all entities from source and target tables
    let [sourceEntities, targetEntities] = await Promise.all([
      this._sourceTable.fetch(this._getSourceFields()),
      this._targetTable.fetch(this._getTargetFields()),
    ]);
    // 3. sync each target entity with a source entity
    let sourceIndex = _.keyBy(sourceEntities, ent =>
      this._sourceTable.getEntityMatchKey(ent));
    delete sourceIndex.undefined;
    let sourceMatched = _.mapValues(sourceIndex, _ => false);
    let updatingEntities = _(targetEntities).map(targetEntity => {
      let matchKey = this._targetTable.getEntityMatchKey(targetEntity);
      if (!matchKey) {
        return;
      }
      let sourceEntity = sourceIndex[matchKey];
      if (sourceEntity) {
        sourceMatched[matchKey] = true;
        let [_, diff] = SyncUtils.syncEntity(
          this._config.syncEntityConfig,
          sourceEntity,
          targetEntity,
        );

        if (diff) {
          diff['id'] = targetEntity['id'];
          return diff;
        }
      }
    }).filter().value();
    let insertingEntities = _(sourceIndex)
      .filter((_, index) => !sourceMatched[index])
      .map(ent =>
        SyncUtils.syncEntity(this._config.syncEntityConfig, ent, {})[0],
      ).value();
    // 4. commit update/insert to the target table
    this.log(`updateCount: ${updatingEntities.length}`);
    this.log(`insertCount: ${insertingEntities.length}`);
    await Promise.all([
      this._targetTable.update(updatingEntities),
      this._targetTable.insert(insertingEntities),
    ]);

    this.log('done');
  }
}

class SyncUtils {
  public static syncEntity (
    config: SyncEntityConfig,
    source: Entity,
    target: any,
  ): [any, any] {
    if (!source) {
      // if no source is given, assume no change
      return [target, undefined];
    }
    if (!target || typeof target !== 'object') {
      target = {};
    }
    let diff = {};
    _.each(config, (conf, field) => {
      let value;
      let childDiff;
      if (typeof conf === 'string') {
        value = source[conf];
      } else if ('transform' in conf) {
        value = conf.transform(source[conf.sourceField]);
      } else if ('sync' in conf) {
        [value, childDiff] = conf.sync(
          conf.config,
          source[conf.sourceField],
          target[field],
        );
        if (childDiff === undefined) {
          return;
        }
      }
      if (value && (childDiff || !_.isEqual(value, target[field]))) {
        diff[field] = value;
        target[field] = value;
      }
    });

    if (Object.keys(diff).length === 0) {
      diff = undefined;
    }
    return [target, diff];
  }

  public static syncEntityArray (
    config: SyncEntityConfig,
    source: Entity[],
    target: any[],
  ): [any, any] {
    if (!source) {
      return [target, undefined];
    }
    let [results, diffs] = _(_.zip(source, target)).map(([s, t]) => {
      if (!s) {
        return [t, undefined];
      }
      return SyncUtils.syncEntity(config, s, t);
    }).unzip().value();
    if (_.reduce(diffs, (carry, d) => carry && d === undefined, true)) {
      diffs = undefined;
    }
    return [results, diffs];
  }

  public static syncEntityArrayHead (
    config: SyncEntityConfig,
    source: Entity[],
    target: any,
  ): [any, any] {
    if (!source || source.length <= 0) {
      return [target, undefined];
    }
    return SyncUtils.syncEntity(config, source[0], target);
  }

  public static billTypeDisplayToCode (displayCode: string): BillTypeCode {
    if (displayCode) {
      return <BillTypeCode>displayCode.toLowerCase().split('.').join('');
    }
  }

  public static billTypeDisplayToChamber (displayCode: string)
  : ChamberType {
    if (!displayCode) {
      return;
    }
    if (displayCode.startsWith('S')) {
      return 'senate';
    } else if (displayCode.startsWith('H')) {
      return 'house';
    } else {
      throw new Error(`Could not determine chamber for code ${displayCode}`);
    }
  }

  public static dateToTimestamp (dateStr: string): number {
    if (dateStr) {
      return Utility.parseDateTimeStringOfFormat(dateStr).getTime();
    }
  }

  public static overwriteArray (data: any[]): any {
    return data ? data : [];
  }
}

const SYNC_BILL_CONFIG: SyncConfig = {
  sourceTable: {
    dbId: 'appp9kTQYOdrmDGuS',
    entityType: 'Bill',
  },
  targetTable: {
    tableName: MongoDbConfig.tableNames.BILLS_TABLE_NAME,
    // mockWrite: true,
  },
  syncEntityConfig: {
    'congress': {
      sourceField: 'congress',
      transform: parseInt,
    },
    'billNumber': {
      sourceField: 'bill number',
      transform: parseInt,
    },
    'billType': {
      sourceField: 'bill type',
      sync: SyncUtils.syncEntityArrayHead,
      config: {
        'id': 'db_ID',
        'name': 'Name',
        'code': {
          sourceField: 'Code',
          transform: SyncUtils.billTypeDisplayToCode,
        },
        'chamber': {
          sourceField: 'Code',
          transform: SyncUtils.billTypeDisplayToChamber,
        },
        'display': 'Code',
      },
    },
    'introducedDate': {
      sourceField: 'date introduced',
      transform: SyncUtils.dateToTimestamp,
    },
    'title': 'bill title',
    'categories': {
      sourceField: 'categories',
      sync: SyncUtils.syncEntityArray,
      config: {
        'name': 'Name',
        'name_zh': 'Name (zh)',
        'description': 'Definition',
      },
    },
    'tags': {
      sourceField: 'tags',
      sync: SyncUtils.syncEntityArray,
      config: {
        'tag': 'Name',
        // 'shortName': 'Short Name',
        // 'name_zh': 'Name (zh)',
        // 'shortName_zh': 'Short Name (zh)',
        // 'notes': 'Notes',
      },
    },
    'relevance': {
      sourceField: 'relevance',
      sync: SyncUtils.syncEntityArrayHead,
      config: {
        'name': 'Name',
        'definition': 'Definition',
      },
    },
    'china': 'china',
    'insight': 'insight',
    // 'comment': 'comment', // TODO add back
    'summary': 'bill summary (en)',
    'summary_zh': 'bill summary (zh)',
    'title_zh': 'bill title (zh)',
    'contributors': {
      sourceField: 'contributor',
      sync: SyncUtils.syncEntityArray,
      config: {
        'name': 'Name',
        'email': 'Email',
      },
    },
    'status': 'status',
  },
};

const SYNC_TAG_CONFIG: SyncConfig = {
  sourceTable: {
    dbId: 'appp9kTQYOdrmDGuS',
    entityType: 'Tag',
  },
  targetTable: {
    tableName: MongoDbConfig.tableNames.TAGS_TABLE_NAME,
    // mockWrite: true,
  },
  syncEntityConfig: {
    'tag': 'Name',
    'shortName': 'Short Name',
    'name_zh': 'Name (zh)',
    'shortName_zh': 'Short Name (zh)',
    'notes': 'Notes',
  },
};

const SYNC_ARTICLE_SNIPPET_CONFIG: SyncConfig = {
  sourceTable: {
    dbId: 'appX2196fiRt2qlzf',
    entityType: 'ArticleSnippet',
  },
  targetTable: {
    tableName: MongoDbConfig.tableNames.ARTICLE_SNIPPETS_TABLE_NAME,
    // mockWrite: true,
  },
  syncEntityConfig: {
    'readableId': 'Readable ID',
    'headline': 'Headline',
    'subhead': 'Subhead',
    'author': 'Author',
    'date': {
      sourceField: 'Date',
      transform: SyncUtils.dateToTimestamp,
    },
    'intro': 'Intro',
    'url': 'URL',
    'imageUrl': 'Image URL',
    'sites': {
      sourceField: 'Publish Sites',
      transform: SyncUtils.overwriteArray,
    },
  },
};

/**
 * tester
 */
export let syncAirtable = (async () => {
  let logPrefix = '';

  logPrefix = '[syncAirtable][bills] ';
  await (new Sync(
    SYNC_BILL_CONFIG,
    new AirtableBillsTable(),
    new MongoBillsTable(logPrefix),
    logPrefix,
  )).sync();

  logPrefix = '[syncAirtable][tags] ';
  await (new Sync(
    SYNC_TAG_CONFIG,
    new AirtableTagsTable(),
    new MongoTagsTable(logPrefix),
    logPrefix,
  )).sync();

  logPrefix = '[syncAirtable][articleSnippets] ';
  await (new Sync(
    SYNC_ARTICLE_SNIPPET_CONFIG,
    new AirtableArticleSnippetsTable(),
    new MongoArticleSnippetsTable(logPrefix),
    logPrefix,
  )).sync();

  return;
});

// syncAirtable();