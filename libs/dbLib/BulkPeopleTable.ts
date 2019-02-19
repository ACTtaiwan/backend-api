import * as aws from 'aws-sdk';
import { TableEntity, DynamoDBTable } from './';

var awsConfig = require('../../config/aws.json');

// BulkPeopleTable

export interface BulkPeopleEntity extends TableEntity {
  // basic info
  id?: string;
  firstname?: string;
  lastname?: string;
  middlename?: string;
  birthday?: string;     // 1955-11-30T08:00:00.000Z
  gender?: string;       // M or F
  lastnameenc?: string;
  religion?: string;

  // external id
  bioguideid?: string;
  osid?: string;
  pvsid?: number;
  twitterid?: string;
  youtubeid?: string;
  fbid?: number;

  // external id (misc.)
  thomasid?: string;
  fecid?: string;
  lismemberid?: string;
  metavidid?: string;
}

export class BulkPeopleTable extends DynamoDBTable {
  public readonly tableName = (<any> awsConfig).dynamodb.BULK_PEOPLE_TABLE_NAME;

  constructor (db: aws.DynamoDB.DocumentClient) {
    super(db);
  }

  public get tableDefinition (): [aws.DynamoDB.KeySchema, aws.DynamoDB.AttributeDefinitions] {
    const keySchema: aws.DynamoDB.KeySchema = [
      { AttributeName: 'id', KeyType: 'HASH'}
    ];
    const attrDef: aws.DynamoDB.AttributeDefinitions = [
      { AttributeName: 'id', AttributeType: 'S' }
    ];
    return [keySchema, attrDef];
  }

  public getAllPeople (...attrNamesToGet: (keyof BulkPeopleEntity)[]): Promise<BulkPeopleEntity[]> {
    return super.getAllItems<BulkPeopleEntity>(attrNamesToGet).then(out => out.results);
  }
}
