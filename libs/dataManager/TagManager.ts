import * as dbLib from '../../libs/dbLib';
import * as _ from 'lodash';
import * as mongoDbLib from '../../libs/mongodbLib';
import { MongoDbConfig } from '../../config/mongodb';

// var awsConfig = require('../../config/aws.json');

export class TagManager {
  private tblBill: mongoDbLib.BillTable;
  private tblTagMeta: mongoDbLib.TagMetaTable;
  private tblTag: mongoDbLib.TagTable;

  private defaultMaxSearchItems: number = 20;
  private allMetaMap: {[id: string]: dbLib.TagMetaEntity};

  public async init () {
    const db = await mongoDbLib.MongoDBManager.instance;

    const tblBillName = MongoDbConfig.tableNames.BILLS_TABLE_NAME;
    this.tblBill = db.getTable(tblBillName);

    const tblTagMetaName = MongoDbConfig.tableNames.TAGS_META_TABLE_NAME;
    this.tblTagMeta = db.getTable(tblTagMetaName);

    const tblTagName = MongoDbConfig.tableNames.TAGS_TABLE_NAME;
    this.tblTag = db.getTable(tblTagName);
  }

  public addTagToBill (tag: string, billId: string, userCount?: {[userId: string]: number}, meta?: dbLib.TagMetaEntity) {
    const promises: Promise<any>[] = [];

    // TagMetaTable
    if (meta) {
      const metaPromise = new Promise(async (resolve, reject) => {
        if (!this.allMetaMap) {
          await this.updateAllMetaMap();
        }
        if (!this.allMetaMap[meta.id]) {
          await this.createTagMeta(meta);
        }
        resolve();
      });
      promises.push(metaPromise);
    }

    // TagTable
    const tagTblPromise = this.tblTag.getTag(tag).then(async tagEntity => {
      if (!tagEntity) {
        const update = <dbLib.TagEntity> { tag, billId: [billId], meta };
        await this.tblTag.putTag(update);
      } else {
        if (tagEntity.billId) {
          await this.tblTag.addBillToTag(tag, billId);
        } else  {
          await this.tblTag.setBillIdArrayToTag(tag, [billId]);
        }
      }
    });
    promises.push(tagTblPromise);

    // BillTable
    const billTblPromise = this.tblBill.getBillById(billId, 'tags').then(async bill => {
      if (bill && !bill.tags) {
        await this.tblBill.createEmptyTagsAttrForBill(billId);
      }
      await this.tblBill.addTagToBill(tag, billId, userCount || {});
    });
    promises.push(billTblPromise);

    return Promise.all(promises).then(() => Promise.resolve());
  }

  public removeTagFromBill (tag: string, billId: string) {
    const promises: Promise<any>[] = [];

    // BillTable
    const billTblPromise = this.tblBill.getBillById(billId, 'tags').then(async bill => {
      if (bill.tags) {
        if (_.isEmpty(bill.tags) || (_.size(bill.tags) === 1 && bill.tags[tag])) {
          await this.tblBill.deleteAttributesFromBill(billId, 'tags');
        } else if (bill.tags[tag]) {
          await this.tblBill.deleteTagFromBill(billId, tag);
        }
      }
    });
    promises.push(billTblPromise);

    // TagTable
    const tagTblPromise = this.tblTag.getTag(tag).then(async tagEntity => {
      if (tagEntity) {
        const isEmptyBillArr = !!tagEntity && !!tagEntity.billId && tagEntity.billId.length === 0;
        const isOnlyBillIdInArr = !!tagEntity && !!tagEntity.billId && (tagEntity.billId.length === 1) && (tagEntity.billId[0] === billId);
        if (!tagEntity.billId || isEmptyBillArr || isOnlyBillIdInArr) {
          await this.tblTag.deleteTag(tag);
        } else if (tagEntity.billId) {
          await this.tblTag.removeBillFromTag(tag, billId);
        }
      }
    });
    promises.push(tagTblPromise);

    return Promise.all(promises).then(() => Promise.resolve());
  }

  public async userActOnTagToBill (tag: string, billId: string, userId: string, action: 'up' | 'down' | number) {
    let updateCount = (count: number = 0) => {
      switch (action) {
        case 'up':
          ++count;
          break;

        case 'down':
          --count;
          break;

        default:
          return <number> action;
      }
      return count;
    };

    const bill = await this.tblBill.getBillById(billId, 'tags');
    if (bill) {
      if (!bill.tags || !bill.tags[tag]) {
        const userCount: {[key: string]: number} = {};
        userCount[userId] = updateCount();
        await this.addTagToBill(tag, billId, userCount);
      } else {
        const count: number = bill.tags[tag][userId] || 0;
        await this.tblBill.updateTagUserCount(tag, billId, userId, updateCount(count));
      }
      await this.updateTagTotalUserCount(tag);
    } else {
      Promise.reject(new Error(`Bill not found. billId = ${billId}`));
    }
  }

  public updateTagTotalUserCount (tag: string): Promise<void> {
    return this.tblTag.getTag(tag).then(async tagEntity => {
      if (tagEntity && tagEntity.billId) {
        const bills = await this.tblBill.getBillsById(tagEntity.billId, 'tags');
        let count: number = 0;
        _.each(bills, b => {
          if (b && b.tags && b.tags[tag]) {
            _.each(b.tags[tag], (val, key) => count += val);
          }
        });
        await this.tblTag.updateTotalUserCount(tag, count);
      }
    });
  }

  public searchTagStartWith (q: string, attrNamesToGet?: (keyof dbLib.TagEntity)[]): Promise<dbLib.TagEntity[]> {
    return this.tblTag.searchTags(q, attrNamesToGet, this.defaultMaxSearchItems, 'begins_with');
  }

  public searchTagContains (q: string, attrNamesToGet?: (keyof dbLib.TagEntity)[]): Promise<dbLib.TagEntity[]> {
    return this.tblTag.searchTags(q, attrNamesToGet, this.defaultMaxSearchItems, 'contains');
  }

  public getTags (tags: string | string[]): Promise<dbLib.TagEntity[]> {
    return tags instanceof Array ?
      this.tblTag.getTags(tags) :
      this.tblTag.getTag(tags).then(out => (out && [out]) || []);
  }

  public getTagsOfBill (billId: string): Promise<dbLib.BillTagEntityDynamoDB> {
    return this.tblBill.getBillById(billId, 'tags')
      .then(bill => <dbLib.BillTagEntityDynamoDB> (bill && bill.tags) || {});
  }

  public isBillWithTag (billId: string, tag: string): Promise<boolean> {
    return this.getTagsOfBill(billId).then(out => out && !!out[tag]);
  }

  public createTagMeta (meta: dbLib.TagMetaEntity) {
    return this.tblTagMeta.putMetaInfo(meta);
  }

  public deleteAllTags () {
    const promises: Promise<any>[] = [];

    // BillTable
    const billTblPromise = this.tblBill.getAllBills('id', 'tags').then(async bills => {
      for (let i = 0; i < bills.length; ++i) {
        const bill = bills[i];
        if (bill.tags) {
          await this.tblBill.deleteAttributesFromBill(bill.id, 'tags');
        }
      }
    });
    promises.push(billTblPromise);

    // TagTable
    const tagTblPromise = this.tblTag.getAllTags('tag').then(async tags => {
      const delTags = _.map(tags, x => x.tag);
      await this.tblTag.deleteTags(delTags);
    });
    promises.push(tagTblPromise);

    return Promise.all(promises).then(() => Promise.resolve());
  }

  private async updateAllMetaMap () {
    const allMeta = await this.tblTagMeta.getAllMetaInfo();
    this.allMetaMap = _.keyBy(allMeta, 'id');
  }
}
