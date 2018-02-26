import { Context, Callback, APIGatewayEvent } from 'aws-lambda'
import { TrackerSync } from '../../../scripts/dataSync/syncTrackers'
import { CongressGovHelper } from '../../../libs/congressGov/CongressGovHelper';
import Response from '../../../libs/utils/Response'
import { AllInfoSync } from '../../../scripts/dataSync/syncAllInfo';

class DailySyncHandler {
  public static handleRequest (event: any, context: Context, callback?: Callback) {
    console.log(`[DynamoDBSyncHandler::handleRequest()] Start.`)
    console.log(`[DynamoDBSyncHandler::handleRequest()] Event = ${JSON.stringify(event, null, 2)}`)
    console.log(`[DynamoDBSyncHandler::handleRequest()] Context = ${JSON.stringify(context, null, 2)}`)
    let promises = []

    promises.push(DailySyncHandler.syncTrackers())
    promises.push(DailySyncHandler.syncAllInfo())

    Promise.all(promises).then(out => {
      let err = out[0] || out[1]
      if (!err) {
        console.log(`[DynamoDBSyncHandler::handleRequest()] Done`)
        callback && Response.success(callback, '', true)
      } else {
        console.log(`[DynamoDBSyncHandler::handleRequest()] Failed. Error = ${JSON.stringify(err, null, 2)}`)
        callback && Response.error(callback, JSON.stringify(err, null, 2), true)
      }
    })
  }

  private static syncTrackers (): Promise<void> {
    return new Promise((resolve, reject) => {
      let sync = new TrackerSync()
      sync.syncTrackersForAllBills(CongressGovHelper.CURRENT_CONGRESS).then(() => {
        console.log(`[DynamoDBSyncHandler::syncTrackers()] Done`)
        resolve()
      }).catch((err) => {
        console.log(`[DynamoDBSyncHandler::syncTrackers()] Failed. Error = ${JSON.stringify(err, null, 2)}`)
        resolve(err)
      })
    })
  }

  private static syncAllInfo (): Promise<void> {
    return new Promise((resolve, reject) => {
      let sync = new AllInfoSync()
      let currentCongress = CongressGovHelper.CURRENT_CONGRESS
      sync.syncAllInfoForAllBills(currentCongress, currentCongress, currentCongress).then(() => {
        console.log(`[DynamoDBSyncHandler::syncAllInfo()] Done`)
        resolve()
      }).catch((err) => {
        console.log(`[DynamoDBSyncHandler::syncAllInfo()] Failed. Error = ${JSON.stringify(err, null, 2)}`)
        resolve(err)
      })
    })
  }
}

export let main = DailySyncHandler.handleRequest
