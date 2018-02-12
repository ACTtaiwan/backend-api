import * as aws from 'aws-sdk'
import * as awsConfig from '../../config/aws.json'
import {TableEntity, Table} from './DbLib'

// CategoryTable

export interface BillCategoryEntity extends TableEntity {
  id: string
  code: string
  name: string
  name_zh?: string
  description?: string
  description_zh?: string
}

export class BillCategoryTable extends Table {
  public readonly tableName = (<any> awsConfig).dynamodb.VOLUNTEER_BILLCATEGORIES_TABLE_NAME

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

  public getAllCategories (): Promise<BillCategoryEntity[]> {
    return super.getAllItems<BillCategoryEntity>().then(out => out.results)
  }
}
