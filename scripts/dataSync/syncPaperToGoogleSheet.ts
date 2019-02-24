import { GoogleSheetAgent } from '../../libs/googleApi/GoogleSheetAgent';
import { DropboxPaperData, PaperTableItem } from '../../dropbox-paper-export/dropboxPaperAgent';
import { BillRow, TagRow, CategoryRow } from '../../libs/googleApi/CongressSheetModels';
import * as _ from 'lodash';
import * as ssimilar from 'string-similarity';
import { v4 as uuid } from 'uuid';
import { GoogleBillSheetSync } from './syncGoogleBillSheet';

export class DropboxPaperToGoogleSheetSync {
  private readonly sheet = new GoogleSheetAgent();
  private readonly paperData: {[key: string]: PaperTableItem} = {};
  private readonly tagWordHelper = new TagWordHelper();

  constructor () {
    const paperItems: PaperTableItem[] = DropboxPaperData.getData('./dropbox-paper-export/paper-export.json');
    this.paperData = _.keyBy(paperItems, x => this.queryKey(x));
  }

  public async syncTags () {
    let billRows = await this.sheet.getBillSheet();
    let tagRows = await this.sheet.getTagSheet();
    await this.syncTagsOnBillSheet(billRows);
    await this.syncTagsSheet(billRows, tagRows);
  }

  public async syncCategory () {
    let billRows = await this.sheet.getBillSheet();
    let catRows = await this.sheet.getCategorySheet();
    await this.syncCategoriesOnBillSheet(billRows, catRows);
  }

  private async syncTagsOnBillSheet (billRows: BillRow[]) {
    for (let rowId = 0; rowId < billRows.length; ++rowId) {
      let row = billRows[rowId];
      let rowTags = row.tags || [];
      let pprTags = (this.paperData[this.queryKey(row)] || {}).tags || [];
      if (!_.isEmpty(pprTags)) {
        const rowMapTags = _.map(rowTags, x => x.toLowerCase());
        const pprMapTags: {[key: string]: string} = _.transform(pprTags, (res, val) => res[val.toLowerCase()] = val, {});
        const pprMapKeys = _.keys(pprMapTags);
        const addTags = _.difference(pprMapKeys, rowMapTags);
        // const unionTags = _.union(pprMapKeys, rowMapTags);

        // filter out the same acronym
        const rowTagWrdGrp = _.map(rowMapTags, x => this.tagWordHelper.wordGroupMap[x] || '').filter(x => x);
        let realAddTags = _.reject(addTags, x => _.includes(rowTagWrdGrp, this.tagWordHelper.wordGroupMap[x] || ''));

        // filter out high string similiarity
        const similarityThreashold: number = 0.9;
        const maxSim: {[key: string]: number} = {};
        _.each(realAddTags, x => {
          const sim: number[] = _.map(rowMapTags, y => ssimilar.compareTwoStrings(x, y));
          maxSim[x] = Math.max(...sim);
        });
        realAddTags = _.filter(realAddTags, x => maxSim[x] < similarityThreashold);

        if (!_.isEmpty(realAddTags)) {
          let finalAddTags: string[] = realAddTags.map(x => pprMapTags[x]);
          let finalUnion: string[] = [...rowTags, ...finalAddTags];
          console.log(`${this.queryKey(row)} (rowId = ${rowId})`);
          console.log(`excel = ${JSON.stringify(rowTags)}`);
          console.log(`paper = ${JSON.stringify(pprTags)}`);
          console.log(`add = ${JSON.stringify(finalAddTags)}`);
          console.log(`union = ${finalUnion}\n`);
          row.tags = finalUnion;
        }
      }
    }

    // batch write to Google sheet
    await this.sheet.rewriteBillSheetTagsColumn(billRows);
  }

  private async syncTagsSheet (billRows: BillRow[], tagRows: TagRow[]): Promise<void> {
    let tagMap = _.keyBy(tagRows, x => x.tag.toLowerCase());
    let invalid: boolean = false;
    _.each(billRows, row => {
      _.each(row.tags, tag => {
        if (!tagMap[tag.toLowerCase()]) {
          tagMap[tag.toLowerCase()] = <TagRow> { tag };
          invalid = true;
        }
      });
    });

    if (invalid) {
      console.log('New tags inserted. Rewriting Google sheet...');
      let data = _.sortBy(_.values(tagMap), (x: TagRow) => [x.tag.toLowerCase()]);
      await this.sheet.rewriteTagSheet(data);
    }
  }

  private async syncCategoriesOnBillSheet (billRows: BillRow[], catRows: CategoryRow[]) {
    let sheetSync = new GoogleBillSheetSync();
    let codeCatRowMap = _.keyBy(catRows, 'code');
    for (let rowId = 0; rowId < billRows.length; ++rowId) {
      let row = billRows[rowId];
      let pprCats = await sheetSync.findCategories((this.paperData[this.queryKey(row)] || {}).category || []);
      let rowCats = await sheetSync.findCategories(row.categories);
      let rowCatCodes = _.map(rowCats, x => x.code);
      let pprCatCodes = _.map(pprCats, x => x.code);
      let interCatCodes = _.intersection(rowCatCodes, pprCatCodes);
      let addCatCodes = _.difference(pprCatCodes, interCatCodes);
      if (!_.isEmpty(addCatCodes)) {
        let finalUnion = _.map([...rowCatCodes, ...addCatCodes], x => codeCatRowMap[x].displayName);
        console.log(`${this.queryKey(row)} (rowId = ${rowId})`);
        console.log(`excel = ${JSON.stringify(rowCatCodes)}`);
        console.log(`paper = ${JSON.stringify(pprCatCodes)}`);
        console.log(`add = ${JSON.stringify(addCatCodes)}`);
        console.log(`union = ${finalUnion}\n`);
        row.categories = finalUnion;
      }
    }

    // batch write to Google sheet
    await this.sheet.rewriteBillSheetCategoryColumn(billRows);
  }

  private queryKey (item: PaperTableItem | BillRow) {
    return `${item.congress}-${item.billTypeDisplay.toLowerCase()}-${item.billNumber}`;
  }
}

export class TagWordHelper {
  private _wordGroup: {[key: string]: string[]};
  private _wordGroupMap: {[key: string]: string};

  public get wordGroupMap (): {[key: string]: string} {
    if (!this._wordGroupMap) {
      this._wordGroupMap = {};
      _.each(this.wordGroup, (val: string[], key) => _.each(val, x => this._wordGroupMap[x] = key));
    }
    return this._wordGroupMap;
  }

  public get wordGroup (): {[key: string]: string[]} {
    if (!this._wordGroup) {
      let acronym = (short: string, long: string): string[] =>
        [short, long, `${short} (${long})`, `${long} (${short})`];
      this._wordGroup = {};
      this._wordGroup[uuid()] = [...acronym('tra', 'taiwan relations act'), ...acronym('tra', 'taiwan relation act')];
      this._wordGroup[uuid()] = [...acronym('wto', 'world trade organization')];
      this._wordGroup[uuid()] = [...acronym('icao', 'international civil aviation organization')];
      this._wordGroup[uuid()] = [...acronym('proc', 'people’s republic of china')];
      this._wordGroup[uuid()] = [...acronym('pla', 'people’s liberation army')];
      this._wordGroup[uuid()] = [...acronym('ait', 'american institute in taiwan')];
    }
    return this._wordGroup;
  }
}

let sync = new DropboxPaperToGoogleSheetSync();
sync.syncCategory();
