import * as aws from 'aws-sdk'
import * as awsConfig from '../../config/aws.json'
import { TableEntity, Table } from './DbLib'

// PersonTable

export interface PersonEntity extends TableEntity {
  id: string
  firstname: string
  lastname: string
  middlename?: string
  searchName: string
  birthday?: string
  gender?: string
  nameMod?: string
  nickname?: string

  createdAt?: number // UTC time
  lastUpdatedAt?: number // UTC time

  bioGuideId?: string
  cspanId?: number
  osId?: string
  pvsId?: number
  twitterId?: string
  youtubeId?: string
}

export class PersonTable extends Table {
  public readonly tableName = (<any> awsConfig).dynamodb.VOLUNTEER_PERSON_TABLE_NAME

  constructor (db: aws.DynamoDB.DocumentClient) {
    super(db)
  }

  public get tableDefinition (): [aws.DynamoDB.KeySchema, aws.DynamoDB.AttributeDefinitions] {
    const keySchema: aws.DynamoDB.KeySchema = [
      { AttributeName: 'id', KeyType: 'HASH'}
    ]
    const attrDef: aws.DynamoDB.AttributeDefinitions = [
      { AttributeName: 'id', AttributeType: 'S' }
    ]
    return [keySchema, attrDef]
  }
}
