import { MongoDBTable } from './MongoDBManager';
import { MongoDbConfig } from '../../config/mongodb';
import * as _ from 'lodash';

export interface ArticleSnippet {
  id: string;
  readableId: string;
  headline?: string;
  subhead?: string;
  author?: string;
  date: number;
  intro?: string;
  url?: string;
  imageUrl?: string;
  sites?: string[];
}

export class ArticleSnippetsTable extends MongoDBTable {
  public readonly tableName =
    MongoDbConfig.tableNames.ARTICLE_SNIPPETS_TABLE_NAME;
  protected readonly suggestPageSize: number = 100;

  public async list (
    site: string,
    limit: number,
    fields: (keyof ArticleSnippet)[] = [],
    before: number = undefined, // timestamp in millisec
  ): Promise<ArticleSnippet[]> {
    let q = {sites: site};
    if (before) {
      q['date'] = {$lt: before};
    }
    return super.queryItems<ArticleSnippet>(q, fields, {date: -1}, limit);
  }
}