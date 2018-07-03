import { TrackerSync } from '../dataSync/syncTrackers'
import { CongressGovHelper } from '../../libs/congressGov/CongressGovHelper'

let test = async () => {
  const congress = CongressGovHelper.CURRENT_CONGRESS
  let sync = new TrackerSync()
  await sync.init()
  sync.syncTrackersForAllBills(congress)
}

test()
