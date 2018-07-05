export const EntityTable = {
  Bill: "Bills",
  BillType: 'Bill Types',
  BillCategory: 'Bill Categories',
  Contributor: 'Volunteers',
  Tag: 'Tags',
  Relevance: 'Relevance',
};
export type EntityType = keyof typeof EntityTable;

export interface Schema {
  readonly fields: {
    [field: string]: EntityType; // null means primitive types
  };
  readonly prefetch?: boolean;
}

export const SCHEMAS: { [t: string]: Schema } = {
  'Bill': {
    fields: {
      'congress': null,
      'bill type': 'BillType',
      'bill number': null,
      'bill title': null,
      'bill title (zh)': null,
      'categories': 'BillCategory',
      'tags': 'Tag',
      'relevence': 'Relevance',
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
    fields: {
      'Code': null,
      'Name': null,
      'Description': null,
      'Code Name': null,
    },
    prefetch: true,
  },
  'BillCategory': {
    fields: {
      'Name': null,
      'Definition': null,
      'Name (zh)': null,
    },
    prefetch: true,
  },
  'Contributor': {
    fields: {
      'Name': null,
      // TODO: 'Photo',
      'Email': null,
    },
    prefetch: true,
  },
  'Tag': {
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
    fields: {
      'Name': null,
      'Definition': null,
    },
    prefetch: true,
  },
};
