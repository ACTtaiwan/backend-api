import { Context, Callback } from 'aws-lambda';
import { TrackerSync } from '../../../scripts/dataSync/syncTrackers';
import { syncAirtable } from '../../../scripts/dataSync/syncAirtable';
import { CongressGovHelper } from '../../../libs/congressGov/CongressGovHelper';
import Response from '../../../libs/utils/Response';
import { AllInfoSync } from '../../../scripts/dataSync/syncAllInfo';
import { main as importAirtable } from '../../../scripts/airtable/importAirtable';
import { TrackerSync as TrackerSyncV2 } from '../../../scripts/dataSyncV2/syncTracker';
import { AllInfoSync as AllInfoSyncV2 } from '../../../scripts/dataSyncV2/syncAllInfo';
import { SponsorSync as SponsorSyncV2 } from '../../../scripts/dataSyncV2/syncSponsor';
import { IntroducedDateSync as IntroducedDateSyncV2 } from '../../../scripts/dataSyncV2/syncIntroDate';

class DailySyncHandler {
  public static handleRequest (event: any, context: Context, callback?: Callback) {
    console.log(`[DailySyncHandler::handleRequest()] Start.`);
    console.log(`[DailySyncHandler::handleRequest()] Event = ${JSON.stringify(event, null, 2)}`);
    console.log(`[DailySyncHandler::handleRequest()] Context = ${JSON.stringify(context, null, 2)}`);

    // This freezes node event loop when callback is invoked
    context.callbackWaitsForEmptyEventLoop = false;

    let promises = [];

    // TODO: remove
    promises.push(DailySyncHandler.syncTrackers());
    promises.push(DailySyncHandler.syncAllInfo());
    promises.push(DailySyncHandler.syncAirtable());

    promises.push(DailySyncHandler.syncTrackersV2());
    promises.push(DailySyncHandler.syncAllInfoV2());
    promises.push(DailySyncHandler.syncSponsorsV2());
    promises.push(DailySyncHandler.syncAirtableV2());
    promises.push(DailySyncHandler.syncIntroDateV2());

    Promise.all(promises).then(out => {
      let err = out[0] || out[1];
      if (!err) {
        console.log(`[DailySyncHandler::handleRequest()] Done`);
        callback && Response.success(callback, '', true);
      } else {
        console.log(`[DailySyncHandler::handleRequest()] Failed. Error = ${JSON.stringify(err, null, 2)}`);
        callback && Response.error(callback, JSON.stringify(err, null, 2), true);
      }
    });
  }

  public static syncTrackers (): Promise<void> {
    return new Promise((resolve, reject) => {
      let sync = new TrackerSync();
      sync.init()
        .then(() => sync.syncTrackersForAllBills(CongressGovHelper.CURRENT_CONGRESS))
        .then(() => {
          console.log(`[DailySyncHandler::syncTrackers()] Done`);
          resolve();
        })
        .catch(err => {
          console.log(`[DailySyncHandler::syncTrackers()] Failed. Error = ${JSON.stringify(err, null, 2)}`);
          resolve(err);
        });
    });
  }

  public static syncAllInfo (): Promise<void> {
    return new Promise((resolve, reject) => {
      let sync = new AllInfoSync();
      let currentCongress = CongressGovHelper.CURRENT_CONGRESS;
      sync.init()
        .then(() => sync.syncAllInfoForAllBills(currentCongress, currentCongress, currentCongress))
        .then(() => {
          console.log(`[DailySyncHandler::syncAllInfo()] Done`);
          resolve();
        }).catch((err) => {
          console.log(`[DailySyncHandler::syncAllInfo()] Failed. Error = ${JSON.stringify(err, null, 2)}`);
          resolve(err);
        });
    });
  }

  public static syncAirtable (...args): Promise<void> {
    return new Promise(async (resolve, reject) => {
      try {
        await syncAirtable(...args);
        resolve();
      } catch (err) {
        console.log(`[DailySyncHandler::syncAirtable()] failed. err = `
          + `${JSON.stringify(err, null, 2)}`);
        reject(err);
      }
    });
  }

  public static syncTrackersV2 (): Promise<void> {
    return new Promise((resolve, reject) => {
      let sync = new TrackerSyncV2();
      sync.init()
        .then(() => sync.syncTrackersForAllBills(CongressGovHelper.CURRENT_CONGRESS))
        .then(() => {
          console.log(`[DailySyncHandler::syncTrackersV2()] Done`);
          resolve();
        })
        .catch(err => {
          console.log(`[DailySyncHandler::syncTrackersV2()] Failed. Error = ${JSON.stringify(err, null, 2)}`);
          resolve(err);
        });
    });
  }

  public static syncAllInfoV2 (): Promise<void> {
    return new Promise((resolve, reject) => {
      let sync = new AllInfoSyncV2();
      let currentCongress = CongressGovHelper.CURRENT_CONGRESS;
      sync.init()
        .then(() => sync.syncAllInfoForAllBills(currentCongress, currentCongress, currentCongress))
        .then(() => {
          console.log(`[DailySyncHandler::syncAllInfoV2()] Done`);
          resolve();
        }).catch((err) => {
          console.log(`[DailySyncHandler::syncAllInfoV2()] Failed. Error = ${JSON.stringify(err, null, 2)}`);
          resolve(err);
        });
    });
  }

  public static syncSponsorsV2 (): Promise<void> {
    return new Promise((resolve, reject) => {
      let sync = new SponsorSyncV2();
      let currentCongress = CongressGovHelper.CURRENT_CONGRESS;
      sync.init()
        .then(() => sync.syncSponsorForAllBills(currentCongress, currentCongress, currentCongress))
        .then(() => {
          console.log(`[DailySyncHandler::syncSponsorsV2()] Done`);
          resolve();
        }).catch((err) => {
          console.log(`[DailySyncHandler::syncSponsorsV2()] Failed. Error = ${JSON.stringify(err, null, 2)}`);
          resolve(err);
        });
    });
  }

  public static syncAirtableV2 (): Promise<void> {
    return new Promise(async (resolve, reject) => {
      try {
        await importAirtable();
        resolve();
      } catch (err) {
        console.log(`[DailySyncHandler::syncAirtableV2()] failed. err = `
          + `${JSON.stringify(err, null, 2)}`);
        reject(err);
      }
    });
  }

  public static syncIntroDateV2 (): Promise<void> {
    return new Promise((resolve, reject) => {
      let sync = new IntroducedDateSyncV2();
      let currentCongress = CongressGovHelper.CURRENT_CONGRESS;
      sync.init(true)
        .then(() => sync.syncIntroducedDateForAllBills(currentCongress, currentCongress, currentCongress))
        .then(() => {
          console.log(`[DailySyncHandler::syncIntroDateV2()] Done`);
          resolve();
        }).catch((err) => {
          console.log(`[DailySyncHandler::syncIntroDateV2()] Failed. Error = ${JSON.stringify(err, null, 2)}`);
          resolve(err);
        });
    });
  }
}

export let main = DailySyncHandler.handleRequest;
