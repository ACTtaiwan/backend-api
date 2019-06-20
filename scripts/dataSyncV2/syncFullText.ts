import {
  CongressGovTextUpdater,
  CongressGovHelper,
} from '../../libs/congressGov';
import * as dbLib2 from '../../libs/dbLib2';
import * as s3Lib from '../../libs/s3Lib';
import * as _ from 'lodash';
import { DataGraphUtils } from '../../libs/dbLib2';

var awsConfig = require('../../config/aws.json');

export class FullTextSync {
  private logger = new dbLib2.Logger('FullTextSync');
  private g: dbLib2.IDataGraph;

  private readonly updater = new CongressGovTextUpdater();

  private readonly s3 = s3Lib.S3Manager.instance();
  private readonly bcktName = (<any>awsConfig).s3
    .VOLUNTEER_BILLS_FULLTEXT_BUCKET_NAME;
  private readonly bckt = <s3Lib.BillTextBucket>(
    this.s3.getBucket(this.bcktName)
  );

  private congressBillsMap: { [congress: number]: dbLib2.IEntBill[] };

  public async init () {
    this.g = await dbLib2.DataGraph.getDefault();
  }

  public async syncAllBills (
    currentCongress: number,
    minUpdateCongress?: number,
    maxUpdateCongress?: number
  ) {
    const fLog = this.logger.in('syncAllBills');
    const minCongress = Math.max(
      minUpdateCongress || CongressGovHelper.MIN_CONGRESS_DATA_AVAILABLE,
      CongressGovHelper.MIN_CONGRESS_DATA_AVAILABLE
    );
    const maxCongress = Math.min(
      maxUpdateCongress || currentCongress,
      currentCongress
    );

    fLog.log(`minCongress = ${minCongress} \t maxCongress = ${maxCongress}`);

    let bills = await this.g.findEntities<dbLib2.IEntBill>(
      { _type: dbLib2.Type.Bill },
      undefined,
      DataGraphUtils.fieldsFromArray([
        'congress',
        'billType',
        'billNumber',
        'versions',
      ])
    );
    bills = _.filter(
      bills,
      x => x.congress >= minCongress && x.congress <= maxCongress
    );

    // build congress <--> bills map
    this.congressBillsMap = _.groupBy(bills, 'congress');
    const keys = _.keys(this.congressBillsMap);
    for (let c = 0; c < keys.length; ++c) {
      let congress = parseInt(keys[c]);
      fLog.log(`Updating congress = ${congress}`);
      await this.batchSyncForCongress(congress);
      fLog.log('\n\n\n');
    }
  }

  public async batchSyncForCongress (congress: number) {
    const fLog = this.logger.in('batchSyncForCongress');
    fLog.log(
      `\n\n---------------------------------- Congress ${congress} ----------------------------------\n\n`
    );
    let bills: dbLib2.IEntBill[] = this.congressBillsMap[congress];
    for (let i = 0; i < bills.length; ++i) {
      fLog.log(
        `\n\n---------------------------------- Bill ${i} / ${bills.length -
          1} ----------------------------------\n\n`
      );
      const bill = bills[i];
      await this.syncBill(bill);
    }
  }

  public async syncBillById (billId: string): Promise<void> {
    const fLog = this.logger.in('syncBillById');

    let bill = await this.g.findEntities<dbLib2.IEntBill>(
      {
        _type: dbLib2.Type.Bill,
        _id: billId,
      },
      undefined,
      DataGraphUtils.fieldsFromArray([
        'congress',
        'billType',
        'billNumber',
        'versions',
      ])
    );

    if (bill && bill[0]) {
      await this.syncBill(bill[0]);
      fLog.log(`Done`);
    } else {
      fLog.log(`Can not find bill of id = ${billId}`);
    }
  }

  public async syncBill (bill: dbLib2.IEntBill): Promise<void> {
    const fLog = this.logger.in('syncBill');
    const billDisplay = dbLib2.CongressUtils.displayBill(bill);
    fLog.log(
      `\n---------------------------------- Updating ${billDisplay} ----------------------------------\n\n`
    );
    try {
      await this.uploadAllText(bill);
      let update = await this.updateMongoDb(bill);
      fLog.log(`\nUPDATED = ${JSON.stringify(update, null, 2)}\n`);
    } catch (err) {
      fLog.log(`[${billDisplay}] ${err}\n`);
    }
  }

  public async listAllBillsForVersionCode (
    versionCode: string
  ): Promise<dbLib2.IEntBill[]> {
    const fLog = this.logger.in('listAllBillsForVersionCode');
    let bills = await this.g.findEntities<dbLib2.IEntBill>(
      { _type: dbLib2.Type.Bill },
      undefined,
      DataGraphUtils.fieldsFromArray([
        'congress',
        'billType',
        'billNumber',
        'versions',
      ])
    );
    bills = _.filter(
      bills,
      b => b.versions && !!_.find(b.versions, v => v.code === versionCode)
    );
    fLog.log(JSON.stringify(bills, null, 2));
    return bills;
  }

  private async updateMongoDb (bill: dbLib2.IEntBill): Promise<dbLib2.IEntBill> {
    const s3Items = await this.bckt.listDocumentsOfBill(
      bill.congress,
      bill.billType,
      bill.billNumber
    );
    const s3ItemMap = _.groupBy(s3Items, 'code');
    const versions: { [code: string]: dbLib2.TextVersion } = {};

    _.each(s3ItemMap, (items, code) => {
      if (!dbLib2.isTextVersionCode(code)) {
        throw new Error(`Can not find bill version for code = ${code}`);
      } else {
        let obj: dbLib2.TextVersion = { code };

        if (items && items[0] && items[0].date) {
          obj.date = items[0].date;
        }

        obj.documents = _.chain(items)
          .filter(doc => !!doc.s3BucketKey)
          .map(
            doc =>
              <dbLib2.S3TextDocument>{
                s3Entity: s3Lib.S3BucketHelper.generateFullUrl(
                  this.bckt.bucketName,
                  doc.s3BucketKey
                ),
                contentType: doc.contentType,
              }
          )
          .value();

        versions[code] = obj;
      }
    });

    const updateVersions = _.values(versions);
    if (!_.isEmpty(updateVersions)) {
      const update = <dbLib2.IEntBill>{
        _type: dbLib2.Type.Bill,
        _id: bill._id,
        versions: updateVersions,
      };
      await this.g.updateEntities([update]);
      return update;
    } else if (!_.isEmpty(bill.versions)) {
      const update = <dbLib2.IEntBill>{
        _type: dbLib2.Type.Bill,
        _id: bill._id,
        versions: undefined,
      };
      await this.g.updateEntities([update]);
      return update;
    }
  }

  private getAllVersionMap (): dbLib2.TextVersionMapByCode {
    return dbLib2.TextVersionMetaHelper.getMetaMap();
  }

  private async uploadAllText (bill: dbLib2.IEntBill): Promise<void> {
    const versionMap = this.getAllVersionMap();
    // key = code, value = version display name
    const codeNameMap: { [code: string]: string } = _.transform(
      versionMap,
      (res, val, key) => (res[key] = val.name),
      {}
    );
    this.updater.parser.versionLookupTable = codeNameMap;
    const cngrGovBillPath = CongressGovHelper.generateCongressGovBillPath(
      bill.congress,
      bill.billType,
      bill.billNumber
    );
    return this.updater.updateAllTextVersions(cngrGovBillPath);
  }
}

if (require.main === module) {
  let sync = new FullTextSync();
  sync
    .init()
    // .then(() => sync.syncAllBills(115, 115, 115))
    .then(() =>
      sync.syncAllBills(
        CongressGovHelper.CURRENT_CONGRESS,
        CongressGovHelper.CURRENT_CONGRESS,
        CongressGovHelper.CURRENT_CONGRESS
      )
    );
  // .then(() => sync.syncBillById('cbcb5e56-b764-468f-9564-3fe0fdeae4a2'))

  // problems:
  //   [106-s-1059 (154155dd-0d68-4a15-ae54-98f747fdef66)] Error: [FullTextSync::updateMongoDb()] can not find bill version for code = pwh

  // sync.syncBill(<any> {
  //   id: '154155dd-0d68-4a15-ae54-98f747fdef66',
  //   congress: 106,
  //   billType: {code: 's'},
  //   billNumber: 1059
  // })

  // let bills = sync.listAllBillsForVersionCode('pwah')
}
