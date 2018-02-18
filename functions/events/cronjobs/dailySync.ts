import { Context, Callback, APIGatewayEvent } from 'aws-lambda'
import { TrackerSync } from '../../../scripts/dataSync/syncTrackers'
import { CongressGovHelper } from '../../../libs/congressGov/CongressGovHelper';
import Response from '../../../libs/utils/Response'

class DailySyncHandler {
  public static handleRequest (event: any, context: Context, callback?: Callback) {
    console.log(`[DynamoDBSyncHandler::handleRequest()] Start.`)
    console.log(`[DynamoDBSyncHandler::handleRequest()] Event = ${JSON.stringify(event, null, 2)}`)
    console.log(`[DynamoDBSyncHandler::handleRequest()] Context = ${JSON.stringify(context, null, 2)}`)
    let sync = new TrackerSync()
    sync.syncTrackersForAllBills(CongressGovHelper.CURRENT_CONGRESS).then(() => {
      console.log(`[DynamoDBSyncHandler::handleRequest()] Done`)
      callback && Response.success(callback, '', true)
    }).catch((err) => {
      console.log(`[DynamoDBSyncHandler::handleRequest()] Failed. Error = ${JSON.stringify(err, null, 2)}`)
      callback && Response.error(callback, JSON.stringify(err, null, 2), true)
    })
  }
}

export let main = DailySyncHandler.handleRequest
