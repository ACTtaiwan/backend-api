import * as _ from 'lodash';
import { AirtableReader } from './AirtableReader';
import { DataGraph, Type, IEnt } from '../../libs/dbLib2/DataGraph';
import { MongoDbConfig } from '../../config/mongodb';
import { DataManager } from '../../libs/dbLib2/DataManager';
import { Logger } from '../../libs/dbLib2/Logger';
import Utility from '../../libs/utils/Utility';

let airtableConfig = {
  'billDbId': 'appp9kTQYOdrmDGuS',
  'billTableName': 'Bills',
  'billTypeTableName': 'Bill Types',
  'relevanceTableName': 'Relevance',
  'tagTableName': 'Tags',

  'articleDbId': 'appX2196fiRt2qlzf',
  'articleTableName': 'Articles',

  'personDbId': 'appv9GLBqyyDP6ObR',
  'personTableName': 'Persons'
};

let logger = new Logger('importAirtable.ts');

function resolveLinkedField (
  src: object,
  field: string,
  lookupTable: object,
  resolveFirstElementOnly = true,
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
  if (!Array.isArray(src[field])) {
    throw Error(`Expecting ${field} field to be an array in `
      + `${JSON.stringify(src)}`);
  }
  if (resolveFirstElementOnly) {
    let id: string = src[field][0];
    if (lookupTable[id] === undefined) {
      throw Error(`Cannot resolve ${field} in ${JSON.stringify(src)}`);
    }
    return lookupTable[id];
  } else {
    let results = _.map(src[field], (id, i) => {
      if (lookupTable[id] === undefined) {
        throw Error(`Cannot resolve ${field} (i=${i}) in `
          + `${JSON.stringify(src)}`);
      }
      return lookupTable[id];
    });
    return results;
  }
}

/**
 * @returns a map of airtable ID to IEnt object
 */
async function composeBillsFromAirtable (
  source: AirtableReader,
  getTagRefsOnly = false,
): Promise<{[id: string]: IEnt}> {
  let [ billTypes, relevances, bills ] = await Promise.all([
    source.readTable(airtableConfig['billTypeTableName']),
    source.readTable(airtableConfig['relevanceTableName']),
    source.readTable(airtableConfig['billTableName']),
  ]);

  let results = _.pickBy(_.mapValues(bills, v => {
    if (!v['congress'] || !v['bill type'] || !v['bill number']) {
      return;
    }

    let billType = resolveLinkedField(v, 'bill type', billTypes);
    if (!billType || !billType['Code']) {
      logger.log(`Bill does not have a bill type: ${JSON.stringify(v)}`);
      return;
    }
    let billTypeCode = billType['Code'].toLowerCase().split('.').join('');

    if (getTagRefsOnly) {
      return {
        _id: undefined,
        _type: Type.Bill,
        congress: parseInt(v['congress']),
        billType: billTypeCode,
        billNumber: parseInt(v['bill number']),
        tags: v['tags'],
      };
    } else {
      let relevance = resolveLinkedField(v, 'relevance', relevances);
      let relevanceScore;
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
    }
  }));

  return results;
}

async function composeTagsFromAirtable (
  source: AirtableReader,
): Promise<{[id: string]: IEnt}> {
  let tags = await source.readTable(airtableConfig['tagTableName']);
  let results = _.pickBy(_.mapValues(tags, v => {
    if (!v['Name']) {
      return;
    }

    return {
      _id: undefined,
      _type: Type.Tag,
      name: v['Name'],
      name_zh: v['Name (zh)'],
    };
  }));

  return results;
}


async function composeAirticlesFromAirtable (
  source: AirtableReader,
): Promise<{[id: string]: IEnt}> {
  let articles = await source.readTable(airtableConfig.articleTableName);
  let results = _.pickBy(_.mapValues(articles, v => {
    if (!v['Headline'] || !v['Readable ID']) {
      return;
    }

    let convertDatetime = (fieldName: string) => {
      // AirTable API returns ISO 8601 formatted date
      // e.g. "2014-09-05T07:00:00.000Z".
      let s = v['Date'];
      return s ? new Date(s).getTime() : undefined;
    };

    return {
      _id: undefined,
      _type: Type.ArticleSnippet,
      readableId: v['Readable ID'],
      headline: v['Headline'],
      subhead: v['Subhead'],
      author: v['Author'],
      date: convertDatetime('Date'),
      intro: v['Intro'],
      url: v['URL'],
      imageUrl: v['Image URL'],
      sites: v['Publish Sites'] || []
    };
  }));

  return results;
}

async function importBills (m: DataManager, source: AirtableReader) {
  let sourceBills = await composeBillsFromAirtable(source);
  await m.importDataset(
    Type.Bill,
    _.values(sourceBills),
    [ 'congress', 'billType', 'billNumber' ],
    Utility.isLocalRun(),
    false,
  );
}

async function importTags (m: DataManager, source: AirtableReader) {
  let sourceTags = await composeTagsFromAirtable(source);
  await m.importDataset(
    Type.Tag,
    _.values(sourceTags),
    [ 'name' ],
    Utility.isLocalRun(),
    false,
  );
}

async function importHasTagAssocs (m: DataManager, source: AirtableReader) {
  let [ airtableBills, airtableTags ] = await Promise.all([
    composeBillsFromAirtable(source, true),
    composeTagsFromAirtable(source),
  ]);

  let [ joinedBills, joinedTags ] = await Promise.all([
    m.loadAllAndJoinWithData(
      Type.Bill,
      _.values(airtableBills),
      [ 'congress', 'billType', 'billNumber' ],
    ),
    m.loadAllAndJoinWithData(
      Type.Tag,
      _.values(airtableTags),
      [ 'name' ],
    )
  ]);
  let bills = _.fromPairs(_.zip(_.keys(airtableBills), joinedBills));
  let tags = _.fromPairs(_.zip(_.keys(airtableTags), joinedTags));

  let hasTagAssocs = [];
  _.each(bills, b => {
    if (!b['_joinedEntry']) {
      throw Error(`Bill does not exist in data graph ${JSON.stringify(b)}`);
    }
    let myTags = resolveLinkedField(b, 'tags', tags, false);
    _.each(myTags, myTag => {
      if (!myTag['_joinedEntry']) {
        throw Error(`Tag does not exist in data graph `
          + `${JSON.stringify(myTag)}`);
      }
      hasTagAssocs.push({
        _type: Type.HasTag,
        _id1: b['_joinedEntry']['_id'],
        _id2: myTag['_joinedEntry']['_id'],
      });
    });
  });

  await m.importDataset(
    Type.HasTag,
    hasTagAssocs,
    [ '_id1', '_id2' ],
    Utility.isLocalRun(),
    false,
  );
}

async function importArticles (m: DataManager, source: AirtableReader) {
  let sourceArticles = await composeAirticlesFromAirtable(source);
  await m.importDataset(
    Type.ArticleSnippet,
    _.values(sourceArticles),
    [ 'readableId' ],
    Utility.isLocalRun(),
    false,
  );
}

async function importPersons (m: DataManager, source: AirtableReader) {
  let airtableRows = await source.readTable(airtableConfig.personTableName);
  let airtablePersons = _.pickBy(_.mapValues(airtableRows, v => {
    if (!v['bioGuideId'] || !v['firstname'] || !v['lastname']) {
      return;
    }
    return {
      _id: undefined,
      _type: Type.Person,
      bioGuideId: v['bioGuideId'],
      firstName: v['firstname'],
      lastName: v['lastname'],
      lastName_zh: v['lastname_zh'],
      firstName_zh: v['firstname_zh'],
    };
  }));

  await m.importDataset(
    Type.Person,
    _.values(airtablePersons),
    [ 'bioGuideId' ],
    Utility.isLocalRun(),
    false,
  );
}

export async function main () {
  let g = await DataGraph.get('MongoGraph', MongoDbConfig.getDbName());
  let m = new DataManager(g);

  let airtableReader = new AirtableReader(airtableConfig.billDbId);
  await importBills(m, airtableReader);
  await importTags(m, airtableReader);
  await importHasTagAssocs(m, airtableReader);

  airtableReader = new AirtableReader(airtableConfig.articleDbId);
  await importArticles(m, airtableReader);

  airtableReader = new AirtableReader(airtableConfig.personDbId);
  await importPersons(m, airtableReader);

  DataGraph.cleanup();

  logger.log('Done');
}

if (require.main === module) {
  main();
}
