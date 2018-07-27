import { MongoDBTable } from './MongoDBManager';
import { MongoDbConfig } from '../../config/mongodb';
import * as _ from 'lodash';

export interface ArticleSnippet {
  id: string;
  readableId: string;
  headline: string;
  subhead?: string;
  author?: string;
  date: number;
  intro?: string;
  url?: string;
  imageUrl?: string;
}

export class ArticleSnippetsTable extends MongoDBTable {
  public readonly tableName =
    MongoDbConfig.tableNames.ARTICLE_SNIPPETS_TABLE_NAME;
  protected readonly suggestPageSize: number = 100;

  public async list (
    limit: number,
    fields: (keyof ArticleSnippet)[] = [],
    before: number = undefined, // timestamp in millisec
  ): Promise<ArticleSnippet[]> {
    return super.queryItems<ArticleSnippet>(
      before ? {date: {$lt: before}} : {},
      fields,
      {date: -1},
      limit,
    );
  }
}