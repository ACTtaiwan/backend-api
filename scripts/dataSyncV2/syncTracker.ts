import { CongressGovHelper, CongressGovTrackerParser, BillTypeCode } from '../../libs/congressGov';
import * as dbLib2 from '../../libs/dbLib2';
import * as _ from 'lodash';

export class TrackerSync {
  private logger = new dbLib2.Logger('TrackerSync');
  private g: dbLib2.IDataGraph;
  private mockWrite: boolean = false;

  private readonly congressGovTrackParser = new CongressGovTrackerParser();

  public async init () {
    this.g = await dbLib2.DataGraph.getDefault();
  }

  public setMockWrite (flag: boolean) {
    this.mockWrite = flag;
  }

  public async syncTrackersForBillEntity (bill: dbLib2.IEntBill) {
    const fLog = this.logger.in('syncTrackersForBillEntity');
    const path = CongressGovHelper.generateCongressGovBillPath(bill.congress, bill.billType, bill.billNumber);
    fLog.log(`path = ${path}`);
    const trackers = await this.congressGovTrackParser.getTracker(path);
    fLog.log(`got tracker`);
    if (!_.isEqual(bill.trackers, trackers)) {
      const update = <dbLib2.IEntBill> {
        _type: dbLib2.Type.Bill,
        _id: bill._id,
        trackers
      };
      fLog.log(`Updating ${path}. Obj = ${JSON.stringify(update, null, 2)}`);
      !this.mockWrite && await this.g.updateEntities([update]);
    } else {
      fLog.log(`Not updating ${path} - same values`);
    }
  }

  public async syncTrackersForAllBills (currentCongress: number) {
    const fLog = this.logger.in('syncTrackersForAllBills');
    const bills = await this.g.findEntities<dbLib2.IEntBill>(
      { _type: dbLib2.Type.Bill },
      undefined,
      ['congress', 'billType', 'billNumber', 'trackers']
    );

    for (let i = 0; i < bills.length; ++i) {
      const bill = bills[i];
      const billDisplay = dbLib2.CongressUtils.displayBill(bill);
      fLog.log(`\n---------------------------------- Bill ${i} / ${bills.length - 1} ${billDisplay} ----------------------------------\n\n`);

      const shouldNotUpdateReason = this.shouldUpdateTrackerForBill(bill, currentCongress);
      if (shouldNotUpdateReason) {
        fLog.log(`Not updating since ${shouldNotUpdateReason}`);
      } else {
        await this.syncTrackersForBillEntity(bill);
      }
      fLog.log('\n\n\n');
    }
  }

  public async syncTrackersForBill (congress: number, billType: BillTypeCode, billNumber: number) {
    const bills = await this.g.findEntities<dbLib2.IEntBill>(
      {
        _type: dbLib2.Type.Bill,
        congress,
        billType,
        billNumber
      },
      undefined,
      ['congress', 'billType', 'billNumber', 'trackers']
    );

    bills && bills[0] && await this.syncTrackersForBillEntity(bills[0]);
  }

  public async printBillsHavingNoTrackers () {
    const bills = await this.g.findEntities<dbLib2.IEntBill>(
      { _type: dbLib2.Type.Bill },
      undefined,
      ['congress', 'billType', 'billNumber', 'trackers']
    );
    const noTrackerBills = _.filter(bills, b => !b.trackers || (b.trackers && b.trackers.length === 0))
    _.each(noTrackerBills, b => console.log(JSON.stringify(b, null, 2)))
  }

  private shouldUpdateTrackerForBill (bill: dbLib2.IEntBill, currentCongress: number): string {
    const earliestCongress = CongressGovHelper.MIN_CONGRESS_DATA_AVAILABLE;
    if (bill.trackers && bill.trackers.length > 0) {
      // having trackers
      if (bill.congress < currentCongress) {
        return `Trackers already available for non-current congress`;
      }
    } else {
      // not having trackers
      if (bill.congress < earliestCongress) {
        return `Congress ${bill.congress} < ${earliestCongress} (earlist available)`;
      }
    }
    return undefined;
  }
}

// let sync = new TrackerSync();
// sync.setMockWrite(true);
// sync.init().then(() => sync.syncTrackersForAllBills(115));
