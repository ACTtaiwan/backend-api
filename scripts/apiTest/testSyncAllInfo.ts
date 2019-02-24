import { AllInfoSync } from '../dataSync/syncAllInfo';
import { CongressGovHelper } from '../../libs/congressGov/CongressGovHelper';

let test = async () => {
  const congress = CongressGovHelper.CURRENT_CONGRESS;
  let sync = new AllInfoSync();
  await sync.init();
  sync.syncAllInfoForAllBills(congress, congress, congress);
};

test();
