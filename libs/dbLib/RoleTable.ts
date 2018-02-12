import * as aws from 'aws-sdk'
import * as awsConfig from '../../config/aws.json'
import { PersonEntity, TableEntity, Table } from './DbLib'

// RoleTable

export interface RoleEntity extends TableEntity {
  id: string
  person: PersonEntity

  createdAt?: number // UTC time
  lastUpdatedAt?: number // UTC time

  startDate?: number // UTC time
  endDate?: number // UTC time
  congressNumbers?: number[]

  title?: string
  titleLong?: string
  roleType?: string
  roleTypeDisplay?: string
  office?: string
  phone?: string
  party?: string
  caucus?: string
  state?: string
  district?: number
  description?: string
  leadershipTitle?: string
  senatorClass?: string
  senatorClassDisplay?: string
  senatorRank?: string
  senatorRankDisplay?: string
  website?: string
}

export class RoleTable extends Table {
  public readonly tableName = (<any> awsConfig).dynamodb.VOLUNTEER_ROLES_TABLE_NAME

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

  public getRolesByCongress (congress: number, ...attrNamesToGet: (keyof RoleEntity)[]): Promise<RoleEntity[]> {
    const filterExp = `contains( congressNumbers, :v_congress )`
    const expAttrVals: aws.DynamoDB.DocumentClient.ExpressionAttributeValueMap = {
      ':v_congress': congress,
    }
    return super.scanItems<RoleEntity>({filterExp, expAttrVals, attrNamesToGet, flushOut: true}).then(out => out.results)
  }
}
