export type EntityType
  = 'Bill'
  | 'BillType'
  | 'BillCategory'
  | 'Contributor'
  | 'Tag'
  | 'Relevance';

export interface Schema {
  readonly table: string;
  readonly fields: {
    [field: string]: EntityType; // null means primitive types
  };
  readonly prefetch?: boolean;
}

export const SCHEMAS: { [key in EntityType]: Schema } = {
  'Bill': {
    table: 'Bills',
    fields: {
      'congress': null,
      'bill type': 'BillType',
      'bill number': null,
      'bill title': null,
      'bill title (zh)': null,
      'categories': 'BillCategory',
      'tags': 'Tag',
      'relevance': 'Relevance',
      'china': null,
      'insight': null,
      'comment': null,
      'contributor': 'Contributor',
      'bill summary (en)': null,
      'bill summary (zh)': null,
      'status': null,
      'date introduced': null,
    },
  },
  'BillType': {
    table: 'Bill Types',
    fields: {
      'Code': null,
      'Name': null,
      'Description': null,
      'Code Name': null,
    },
    prefetch: true,
  },
  'BillCategory': {
    table: 'Bill Categories',
    fields: {
      'Name': null,
      'Definition': null,
      'Name (zh)': null,
    },
    prefetch: true,
  },
  'Contributor': {
    table: 'Volunteers',
    fields: {
      'Name': null,
      // TODO: 'Photo',
      'Email': null,
    },
    prefetch: true,
  },
  'Tag': {
    table: 'Tags',
    fields: {
      'Name': null,
      'Notes': null,
      'Name (zh)': null,
      'Short Name': null,
      'Short Name (zh)': null,
    },
    prefetch: true,
  },
  'Relevance': {
    table: 'Relevance',
    fields: {
      'Name': null,
      'Definition': null,
    },
    prefetch: true,
  },
};
