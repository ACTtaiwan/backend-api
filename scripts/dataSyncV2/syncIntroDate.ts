import { CongressGovIntroDateParser, CongressGovHelper } from '../../libs/congressGov';
import * as dbLib2 from '../../libs/dbLib2';
import * as _ from 'lodash';

export class IntroducedDateSync {
  private logger = new dbLib2.Logger('IntroducedDateSync');
  private g: dbLib2.IDataGraph;
  private mockWrite: boolean = false;

  private readonly congressGovIntroDateParser = new CongressGovIntroDateParser();

  public async init () {
    this.g = await dbLib2.DataGraph.getDefault();
  }

  public setMockWrite (flag: boolean) {
    this.mockWrite = flag;
  }

  public async syncIntroducedDateForAllBills (currentCongress: number, minUpdateCongress?: number, maxUpdateCongress?: number) {
    const fLog = this.logger.in('syncIntroducedDateForAllBills');
    const minCongress = Math.max(minUpdateCongress || CongressGovHelper.MIN_CONGRESS_DATA_AVAILABLE,
                                 CongressGovHelper.MIN_CONGRESS_DATA_AVAILABLE);
    const maxCongress = Math.min(maxUpdateCongress || currentCongress,
                                 currentCongress);

    fLog.log(`minCongress = ${minCongress} \t maxCongress = ${maxCongress}`);

    let bills = await this.g.findEntities<dbLib2.IEntBill>(
      { _type: dbLib2.Type.Bill },
      undefined,
      ['congress', 'billType', 'billNumber', 'introducedDate']
    );
    bills = _.filter(bills, x => x.congress >= minCongress && x.congress <= maxCongress);

    // build congress <--> bills map
    const congressBillsMap = _.groupBy(bills, 'congress');
    const keys = _.keys(congressBillsMap);
    for (let c = 0; c < keys.length; ++c) {
      let congress = parseInt(keys[c]);
      let bills = congressBillsMap[congress];
      fLog.log(`Updating congress = ${congress}`);
      await this.batchSync(bills);
      fLog.log('\n\n\n');
    }
  }

  public async batchSync (bills: dbLib2.IEntBill[]) {
    const fLog = this.logger.in('batchSyncForCongress');

    for (let i = 0; i < bills.length; ++i) {
      fLog.log(`\n\n---------------------------------- Bill ${i} / ${bills.length - 1} ----------------------------------\n\n`);
      const bill = bills[i];
      const path = CongressGovHelper.generateCongressGovBillPath(bill.congress, bill.billType, bill.billNumber);
      const billDisplay = dbLib2.CongressUtils.displayBill(bill);

      fLog.log(`\n${billDisplay} -- Updating introduced date --\n`);

      const introDate = await this.congressGovIntroDateParser.getIntroducedDate(path);
      if (introDate) {
        if (bill.introducedDate !== introDate) {
          const update = <dbLib2.IEntBill> {
            _type: dbLib2.Type.Bill,
            _id: bill._id,
            introducedDate: introDate
          };
          !this.mockWrite && await this.g.updateEntities([update]);
          fLog.log(`bill.introducedDate (${bill.introducedDate}) !== ${introDate} --> bill updated.`);
        }
      } else if (!!bill.introducedDate) {
        const update = <dbLib2.IEntBill> {
          _type: dbLib2.Type.Bill,
          _id: bill._id,
          introducedDate: undefined
        };
        !this.mockWrite && await this.g.updateEntities([update]);
        fLog.log(`bill.introducedDate (${bill.introducedDate}) removed.`);
      }
    }
  }
}

// let sync = new IntroducedDateSync();
// sync.setMockWrite(true);
// sync.init()
  // .then(() => sync.syncIntroducedDateForAllBills(CongressGovHelper.CURRENT_CONGRESS))
  // .then(() => sync.syncIntroducedDateForAllBills(115, 115, 115));