import {
  CongressGovHelper,
  CongressGovSponsorParser,
  CongressGovAllInfoParser,
} from '../../libs/congressGov';
import * as dbLib2 from '../../libs/dbLib2';
import * as _ from 'lodash';
import { DataGraphUtils } from '../../libs/dbLib2';

/**
 *  sync for sponsors & co-sponsors
 */
export class SponsorSync {
  private logger = new dbLib2.Logger('SponsorSync');
  private g: dbLib2.IDataGraph;
  private mockWrite: boolean = false;

  private readonly congressGovSponsorParser = new CongressGovSponsorParser();
  private readonly congressGovAllInfoParser = new CongressGovAllInfoParser();

  // private readonly roleMapSearchId =
  //   (bioGuideId: string, chamber: ChamberType) => bioGuideId + '-' + chamber

  public async init () {
    this.g = await dbLib2.DataGraph.getDefault();
  }

  public setMockWrite (flag: boolean) {
    this.mockWrite = flag;
  }

  public async syncSponsorForAllBills (
    currentCongress: number = CongressGovHelper.CURRENT_CONGRESS,
    minUpdateCongress: number = CongressGovHelper.MIN_CONGRESS_DATA_AVAILABLE,
    maxUpdateCongress: number = currentCongress
  ) {
    const fLog = this.logger.in('syncSponsorForAllBills');

    let bills = await this.g.findEntities<dbLib2.IEntBill>(
      { _type: dbLib2.Type.Bill },
      undefined,
      DataGraphUtils.fieldsFromArray([
        'congress',
        'billType',
        'billNumber',
        'introducedDate',
      ])
    );

    // filter out bills whose data is not available at congress.gov
    const minCongress = Math.max(
      CongressGovHelper.MIN_CONGRESS_DATA_AVAILABLE,
      minUpdateCongress
    );
    const maxCongress = Math.min(currentCongress, maxUpdateCongress);
    bills = _.filter(
      bills,
      x => x.congress >= minCongress && x.congress <= maxCongress
    );

    // build congress <--> bills map
    const congressBillsMap = _.groupBy(bills, 'congress');
    const keys = _.keys(congressBillsMap);
    for (let c = 0; c < keys.length; ++c) {
      let congress = parseInt(keys[c]);
      let bills = congressBillsMap[congress];
      fLog.log(`Updating congress = ${congress}`);
      await this.batchSyncForCongress(congress, bills);
      fLog.log('\n\n\n');
    }
  }

  public async batchSyncForCongress (
    congress: number,
    bills: dbLib2.IEntBill[]
  ) {
    const fLog = this.logger.in('syncSponsorForAllBills');
    const memberMap = await this.buildMemberMapOfCongress(congress);

    for (let i = 0; i < bills.length; ++i) {
      const bill = bills[i];
      const path = CongressGovHelper.generateCongressGovBillPath(
        bill.congress,
        bill.billType,
        bill.billNumber
      );
      const billDisplay = dbLib2.CongressUtils.displayBill(bill);

      fLog.log(
        `\n-----------------------------------${billDisplay} - Updating sponsor -----------------------------------\n`
      );

      const sponsor = await this.congressGovSponsorParser.getSponsorBioGuideId(
        path
      );
      if (!!sponsor.bioGuideId) {
        const sponsorMember = memberMap[sponsor.bioGuideId];
        const sponsorAssoc = <dbLib2.IAssocSponsorAssoc>{
          _type: dbLib2.Type.Sponsor,
          _id1: sponsorMember._id,
          _id2: bill._id,
        };

        // find existing sponsor-bill edges in DB
        const billSponsorInDb = await this.g.findAssocs({
          _type: dbLib2.Type.Sponsor,
          _id2: bill._id,
        });

        // perform DB operations
        this.resolveDbOperations(billSponsorInDb, [sponsorAssoc]);
      }

      fLog.log(
        `\n-----------------------------------${billDisplay} - Updating co-sponsors -----------------------------------\n`
      );

      const allInfo = await this.congressGovAllInfoParser.getAllInfo(path);
      const cosponsorAssocs: dbLib2.IAssocCosponsorAssoc[] = [];
      for (let j = 0; j < allInfo.cosponsors.length; ++j) {
        const item = allInfo.cosponsors[j];
        const bioGuidId = item.cosponsor && item.cosponsor.bioGuideId;
        if (!!bioGuidId) {
          const cosponsorMember = memberMap[bioGuidId];
          const assoc = <dbLib2.IAssocCosponsorAssoc>{
            _type: dbLib2.Type.Cosponsor,
            _id1: cosponsorMember._id,
            _id2: bill._id,
            date: item.dateCosponsored || undefined,
          };
          cosponsorAssocs.push(assoc);
        }
      }

      // find existing cosponsor-bill edges in DB
      const billCosponsorInDb = await this.g.findAssocs({
        _type: dbLib2.Type.Cosponsor,
        _id2: bill._id,
      });

      // perform DB operations
      this.resolveDbOperations(billCosponsorInDb, cosponsorAssocs);

      fLog.log('\n\n');
    }
  }

  private async buildMemberMapOfCongress (
    congress: number
  ): Promise<{ [bioGuideId: string]: dbLib2.IEntPerson }> {
    const fLog = this.logger.in('buildMemberMapOfCongress');
    const entQuery: dbLib2.IEntQuery<dbLib2.IEntPerson> = {
      _type: dbLib2.Type.Person,
      congressRoles: {
        _op: 'has_any',
        _val: {
          congressNumbers: congress,
        },
      },
    };
    const m = await this.g.findEntities<dbLib2.IEntPerson>(entQuery);
    fLog.log(`Found ${m.length} members in congress ${congress}`);
    return _.keyBy(m, 'bioGuideId');
  }

  private async resolveDbOperations<T extends dbLib2.IAssoc> (
    assocInDb: T[],
    assocImposed: T[]
  ) {
    const fLog = this.logger.in('resolveDbOperations');
    fLog.log(`--- DB Operations ---`);

    const isEqualAssoc = (u: dbLib2.IAssoc, v: dbLib2.IAssoc) =>
      u._id1 === v._id1 && u._id2 === v._id2;
    const deleteSet = _.differenceWith(assocInDb, assocImposed, isEqualAssoc);
    const updateSet = _.intersectionWith(assocInDb, assocImposed, isEqualAssoc);
    const appendSet = _.differenceWith(assocImposed, assocInDb, isEqualAssoc);

    // delete
    if (!_.isEmpty(deleteSet)) {
      fLog.log(`Delete objs = ${JSON.stringify(deleteSet, null, 2)}`);
      !this.mockWrite &&
        (await this.g.deleteAssocs(_.map(deleteSet, x => x._id)));
    }

    // append
    if (!_.isEmpty(appendSet)) {
      fLog.log(`Append objs = ${JSON.stringify(appendSet, null, 2)}`);
      !this.mockWrite && (await this.g.insertAssocs(appendSet));
    }

    // update
    if (!_.isEmpty(updateSet)) {
      fLog.log(`Update objs = ${JSON.stringify(updateSet, null, 2)}`);

      // remove _id to be compared with assocImposed (Id is TBD)
      const updateSetNoId = _.map(updateSet, x => {
        const c = _.cloneDeep(x);
        delete c._id;
        return c;
      });

      for (let i = 0; i < updateSetNoId.length; ++i) {
        const assocInDb = updateSetNoId[i];
        const compFunc = _.partial(isEqualAssoc, assocInDb);
        const assocOptIn = _.remove(assocImposed, compFunc)[0];

        fLog.log(`Old = ${JSON.stringify(assocInDb, null, 2)}`);
        fLog.log(`New = ${JSON.stringify(assocOptIn, null, 2)}`);

        if (!_.isEqual(assocInDb, assocOptIn)) {
          fLog.log(`Different --> Updating`);
          !this.mockWrite && (await this.g.updateAssocs([assocOptIn]));
        } else {
          fLog.log(`Equal --> Skip updating`);
        }
      }
    }
  }
}

if (require.main === module) {
  let sync = new SponsorSync();
  // sync.setMockWrite(true);
  sync.init().then(() => sync.syncSponsorForAllBills(116, 116, 116));
  // patch('df717157-4d7b-4a55-acf4-eae451f2ff64')
}
