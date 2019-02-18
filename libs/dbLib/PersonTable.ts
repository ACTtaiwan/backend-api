import * as aws from 'aws-sdk';
import { TableEntity, DynamoDBTable, QueryInput } from './';
import { ProfilePictureResolution } from '../s3Lib';

var awsConfig = require('../../config/aws.json');

// PersonTable

export interface PersonEntityCommitteeAssignment {
  id?: number;
  committee?: number;
  person?: number;
  role?: string;
  role_label?: string;
}

export interface PersonEntity extends TableEntity {
  // basic info
  id: string;
  firstname: string;
  lastname: string;
  middlename?: string;
  searchName: string;
  birthday?: string;
  gender?: string;
  nameMod?: string;
  nickname?: string;

  // committee
  committeeAssignments?: PersonEntityCommitteeAssignment[];

  // external id
  bioGuideId?: string;
  cspanId?: number;
  osId?: string;
  pvsId?: number;
  twitterId?: string;
  youtubeId?: string;
  govTrackId?: number;

  // misc.
  createdAt?: number; // UTC time
  lastUpdatedAt?: number; // UTC time

  // pics
  profilePictures: {[res in ProfilePictureResolution]?: string}; // resolution <--> s3 url
}

export class PersonTable extends DynamoDBTable {
  public readonly tableName = (<any> awsConfig).dynamodb.VOLUNTEER_PERSON_TABLE_NAME;

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

  public putPerson (item: PersonEntity): Promise<aws.DynamoDB.DocumentClient.PutItemOutput> {
    return super.putItem(item);
  }

  public getPersonsById (idx: string[], ...attrNamesToGet: (keyof PersonEntity)[]): Promise<PersonEntity[]> {
    return super.getItems<PersonEntity>('id', idx, attrNamesToGet);
  }

  public getAllPersons (...attrNamesToGet: (keyof PersonEntity)[]): Promise<PersonEntity[]> {
    return super.getAllItems<PersonEntity>(attrNamesToGet).then(out => out.results);
  }

  public async forEachBatchOfAllPersons (
    callback: (batchRoles: PersonEntity[], lastKey?: string) => Promise<boolean | void>,
    attrNamesToGet?: (keyof PersonEntity)[]
  ): Promise<void> {
    return super.forEachBatch('id', callback, attrNamesToGet);
  }

  public getPersonByBioGuideId (bioGuideId: string, attrNamesToGet?: (keyof PersonEntity)[]): Promise<PersonEntity> {
    let input: QueryInput<PersonEntity> = {
      indexName: 'bioGuideId-index',
      keyExp: `#k_key = :v_key`,
      expAttrNames: {'#k_key': 'bioGuideId'},
      expAttrVals: {':v_key': bioGuideId},
      flushOut: true,
      attrNamesToGet
    };
    return super.queryItem<PersonEntity>(input).then(out => (out.results && out.results[0]) || null);
  }

  public updatePerson (id: string, item: PersonEntity)
  : Promise<aws.DynamoDB.DocumentClient.UpdateItemOutput> {
    return super.updateItem<PersonEntity>('id', id, item);
  }
}
