import { CongressGovAllInfoParser, CongressGovHelper } from '../../libs/congressGov';
import * as dbLib2 from '../../libs/dbLib2';
import * as s3Lib from '../../libs/s3Lib';
import * as _ from 'lodash';

var awsConfig = require('../../config/aws.json');

export class AllInfoSync {
  private logger = new dbLib2.Logger('AllInfoSync');
  private g: dbLib2.IDataGraph;

  public readonly congressGovAllInfoParser = new CongressGovAllInfoParser();

  private readonly s3 = s3Lib.S3Manager.instance();
  private readonly bcktName = (<any> awsConfig).s3.VOLUNTEER_BILLS_STATICINFO_BUCKET_NAME;
  private readonly bckt = <s3Lib.BillStaticInfoBucket> this.s3.getBucket(this.bcktName);

  private congressBillsMap: {[congress: number]: dbLib2.IEntBill[]};

  public async init () {
    this.g = await dbLib2.DataGraph.getDefault();
  }

  public async syncAllInfoForAllBills (
    currentCongress: number,
    minUpdateCongress?: number,
    maxUpdateCongress?: number,
    attrNames: (keyof dbLib2.IEntBill)[] = ['actions', 'actionsAll', 's3Entity']
  ) {
    const fLog = this.logger.in('syncAllInfoForAllBills');
    const minCongress = Math.max(minUpdateCongress || CongressGovHelper.MIN_CONGRESS_DATA_AVAILABLE,
                                 CongressGovHelper.MIN_CONGRESS_DATA_AVAILABLE);
    const maxCongress = Math.min(maxUpdateCongress || currentCongress,
                                 currentCongress);

    fLog.log(`minCongress = ${minCongress} \t maxCongress = ${maxCongress}`);

    let bills = await this.g.findEntities<dbLib2.IEntBill>(
      { _type: dbLib2.Type.Bill },
      undefined,
      ['congress', 'billType', 'billNumber', ...attrNames]
    );
    bills = _.filter(bills, x => x.congress >= minCongress && x.congress <= maxCongress);

    // build congress <--> bills map
    this.congressBillsMap = _.groupBy(bills, 'congress');
    const keys = _.keys(this.congressBillsMap);
    for (let c = 0; c < keys.length; ++c) {
      let congress = parseInt(keys[c]);
      fLog.log(`Updating congress = ${congress}`);
      await this.batchSyncForCongress(congress, attrNames);
      fLog.log('\n\n\n');
    }
  }

  public async batchSyncForCongress (congress: number, attrNames: (keyof dbLib2.IEntBill)[]) {
    const fLog = this.logger.in('batchSyncForCongress');
    let bills: dbLib2.IEntBill[] = this.congressBillsMap[congress];
    for (let i = 0; i < bills.length; ++i) {
      const bill = bills[i];
      const billDisplay = dbLib2.CongressUtils.displayBill(bill);
      fLog.log(`\n${billDisplay} -- Updating all info (${i} / ${bills.length}) --\n`);
      await this.syncForBill(bill, attrNames);
    }
  }

  public async patchSingleBill (billId: string) {
    const fLog = this.logger.in('patchSingleBill');
    let attrNames: (keyof dbLib2.IEntBill)[] = ['actions', 'actionsAll', 's3Entity'];

    let bill = await this.g.findEntities<dbLib2.IEntBill>({
        _type: dbLib2.Type.Bill,
        _id: billId
      },
      undefined,
      ['congress', 'billType', 'billNumber', ...attrNames]
    );

    if (bill && bill[0]) {
      await this.syncForBill(bill[0], attrNames);
      fLog.log(`Done`);
    } else {
      fLog.log(`Can not find bill of id = ${billId}`);
    }
  }

  public async syncForBill (bill: dbLib2.IEntBill, attrNames: (keyof dbLib2.IEntBill)[]) {
    const fLog = this.logger.in('syncForBill');
    const hasAttr = (key: keyof dbLib2.IEntBill): boolean => _.includes(attrNames, key);
    const path = CongressGovHelper.generateCongressGovBillPath(bill.congress, bill.billType, bill.billNumber);
    const allInfo = await this.congressGovAllInfoParser.getAllInfo(path);
    if (allInfo) {
      let updateBill: Partial<dbLib2.IEntBill> = {};

      // actions overview
      if (hasAttr('actions')) {
        if (allInfo.actionsOverview && allInfo.actionsOverview.length > 0) {
          if (!_.isEqual(bill.actions, allInfo.actionsOverview)) {
            updateBill.actions = allInfo.actionsOverview;
          }
        } else if (bill.actions) {
          updateBill.actions = undefined;
        }
      }

      // actions all
      if (hasAttr('actionsAll')) {
        if (allInfo.actionsAll && allInfo.actionsAll.length > 0) {
          if (!_.isEqual(bill.actionsAll, allInfo.actionsAll)) {
            updateBill.actionsAll = allInfo.actionsAll;
          }
        } else if (bill.actionsAll) {
          updateBill.actionsAll = undefined;
        }
      }

      // s3Entity
      if (hasAttr('s3Entity')) {
        if (allInfo.summaryLatest || allInfo.summaryAll) {
          const staticInfo = <s3Lib.BillStaticInfo> {
            summaryLatest: allInfo.summaryLatest || {},
            summaryAll: allInfo.summaryAll || []
          };

          let obj = await this.bckt.getEntity(bill.congress, bill.billType, bill.billNumber);
          !obj && fLog.log(`Did not find exisitng S3 object.`);
          const url = this.bckt.s3FullUrl(bill.congress, bill.billType, bill.billNumber);

          if (obj && _.isEqual(obj, staticInfo)) {
            fLog.log(`Found S3 same value. Not updating.`);
            if (!bill.s3Entity) {
              fLog.log(`S3 URL is missing. Set it back.`);
              updateBill.s3Entity = url;
            }
          } else {
            fLog.log(`Putting S3 object = ${url}`);
            await this.bckt.putEntity(staticInfo, bill.congress, bill.billType, bill.billNumber);
            updateBill.s3Entity = url;
          }
        } else if (bill.s3Entity) {
          updateBill.s3Entity = undefined;
        }
      }

      if (!_.isEmpty(updateBill)) {
        try {
          fLog.log(`Writing to database. Object size = ${JSON.stringify(updateBill).length}`);
          updateBill._type = dbLib2.Type.Bill;
          updateBill._id = bill._id;
          fLog.log(`Writing to database. Object = ${JSON.stringify(updateBill, null, 2)}`);
          await this.g.updateEntities([updateBill as dbLib2.IEntBill]);
        } catch (error) {
          throw new Error(`DB error = ${JSON.stringify(error, null, 2)}`);
        }
      }
    } else {
      fLog.log(`parsing failed\n`);
    }
  }
}

// let sync = new AllInfoSync()
// sync.init().then(() => sync.patchSingleBill('95616e24-6ee1-4949-8f29-a79dfccccc5e'))
// sync.init().then(() => sync.syncAllInfoForAllBills(115, 115, 115));