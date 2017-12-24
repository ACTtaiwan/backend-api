import { Context, Callback, DynamoDBStreamEvent } from 'aws-lambda'

class DynamoDBSyncHandler {
  public static handleRequest (event: DynamoDBStreamEvent, context: Context, callback?: Callback) {
      console.log('Received event:', JSON.stringify(event, null, 2));
      event.Records.forEach((record) => {
        console.log(record.eventID);
        console.log(record.eventName);
        console.log('DynamoDB Record: %j', record.dynamodb);
    });
    callback(null, `Successfully processed ${event.Records.length} records.`);
  }
}

export let main = DynamoDBSyncHandler.handleRequest
