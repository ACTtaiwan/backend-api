import * as _ from 'lodash';
import { AirtableReader } from './AirtableReader';
import { DataGraph, Type } from '../../libs/dbLib2/DataGraph';
import { MongoDbConfig } from '../../config/mongodb';
import { DataManager } from '../../libs/dbLib2/DataManager';
import { Logger } from '../../libs/dbLib2/Logger';
import Utility from '../../libs/utils/Utility';

let config = {
  'dbId': 'appp9kTQYOdrmDGuS',
  'billTableName': 'Bills',
  'billTypeTableName': 'Bill Types',
  'relevanceTableName': 'Relevance',
  'tagTableName': 'Tags',
}

let logger = new Logger('importAirtable.ts');

function resolveLinkedField (
  src: object,
  field: string,
  lookupTable: object,
): object {
  if (!src) {
    throw Error('Cannot resolve a null object');
  }
  if (
    src[field] === undefined ||
    src[field] === null ||
    !Array.isArray(src[field])
  ) {
    return;
  }
  let id: string = src[field][0];
  if (lookupTable[id] === undefined) {
    throw Error(`Cannot resolve ${field} in ${JSON.stringify(src)}`);
  }
  return lookupTable[id];
}

async function importBills (m: DataManager, source: AirtableReader) {
  let billTypes = await source.readTable(config['billTypeTableName']);
  let relevances = await source.readTable(config['relevanceTableName']);
  let bills = await source.readTable(config['billTableName']);

  let sourceBills = _.filter(_.map(bills, v => {
    if (!v['congress'] || !v['bill type'] || !v['bill number']) {
      return;
    }

    let billType = resolveLinkedField(v, 'bill type', billTypes);
    if (!billType || !billType['Code']) {
      logger.log(`Bill does not have a bill type: ${JSON.stringify(v)}`);
      return;
    }
    let billTypeCode = billType['Code'].toLowerCase().split('.').join('');

    let relevance = resolveLinkedField(v, 'relevance', relevances);
    let relevanceScore = undefined;
    if (relevance && relevance['score']) {
      relevanceScore = parseInt(relevance['score']);
    }

    return {
      _id: undefined,
      _type: Type.Bill,
      congress: parseInt(v['congress']),
      billType: billTypeCode,
      billNumber: parseInt(v['bill number']),
      title: v['bill title'],
      title_zh: v['bill title (zh)'],
      relevance: relevanceScore,
      summary: v['bill summary (en)'],
      summary_zh: v['bill summary (zh)'],
    };
  }));

  await m.importDataset(
    Type.Bill,
    sourceBills,
    [ 'congress', 'billType', 'billNumber' ],
    Utility.isLocalRun(),
    false,
  );
}

async function main () {
  let g = await DataGraph.get('MongoGraph', MongoDbConfig.getDbName());
  let m = new DataManager(g);
  let airtableReader = new AirtableReader(config['dbId']);

  await importBills(m, airtableReader);

  DataGraph.cleanup();

  logger.log('Done');
}

main();