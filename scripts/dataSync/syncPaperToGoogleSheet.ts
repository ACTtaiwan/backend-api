import GoogleSheetAgent from '../../libs/googleApi/GoogleSheetAgent'
import { DropboxPaperData, PaperTableItem } from '../../dropbox-paper-export/dropboxPaperAgent'
import { BillRow } from '../../libs/googleApi/CongressSheetModels';
import * as fs from 'fs'
import * as _ from 'lodash'
import * as ssimilar from 'string-similarity'
import { v4 as uuid } from 'uuid';

export class DropboxPaperToGoogleSheetSync {
  private readonly sheet = new GoogleSheetAgent()
  private readonly paperData: {[key: string]: PaperTableItem} = {}
  private readonly tagWordHelper = new TagWordHelper()

  constructor () {
    const paperItems: PaperTableItem[] = DropboxPaperData.getData('./dropbox-paper-export/paper-export.json')
    this.paperData = _.keyBy(paperItems, x => this.queryKey(x))
  }

  public async syncTags () {
    let billRows = await this.sheet.getBillSheet()
    let tagRows = await this.sheet.getTagSheet()
    _.each(billRows, row => {
      let rowTags = row.tags || []
      let pprTags = (this.paperData[this.queryKey(row)] || {}).tags || []
      if (!_.isEmpty(rowTags) && !_.isEmpty(pprTags)) {
        rowTags = _.map(rowTags, x => x.toLowerCase())
        const pprMapTags = _.transform(pprTags, (res, val) => res[val.toLowerCase()] = val, {})
        const pprMapKeys = _.keys(pprMapTags)
        const addTags = _.difference(pprMapKeys, rowTags)
        const unionTags = _.union(pprMapKeys, rowTags)

        // filter out the same acronym
        const rowTagWrdGrp = _.map(rowTags, x => this.tagWordHelper.wordGroupMap[x] || '').filter(x => x)
        let realAddTags = _.reject(addTags, x => _.includes(rowTagWrdGrp, this.tagWordHelper.wordGroupMap[x] || ''))

        // filter out high string similiarity
        const similarityThreashold: number = 0.9
        const maxSim: {[key: string]: number} = {}
        _.each(realAddTags, x => {
          const sim: number[] = _.map(rowTags, y => ssimilar.compareTwoStrings(x, y))
          maxSim[x] = Math.max(...sim)
        })
        realAddTags = _.filter(realAddTags, x => maxSim[x] < similarityThreashold)

        if (!_.isEmpty(realAddTags)) {
          console.log(`${this.queryKey(row)}`)
          console.log(`excel = ${JSON.stringify(rowTags)}`)
          console.log(`paper = ${JSON.stringify(pprTags)}`)
          console.log(`add = ${JSON.stringify(realAddTags.map(x => pprMapTags[x]))}`)
          console.log(`union = ${JSON.stringify(unionTags)}\n`)
        }
      }
    })
  }

  private queryKey (item: PaperTableItem | BillRow) {
    return `${item.congress}-${item.billTypeDisplay}-${item.billNumber}`
  }
}

export class TagWordHelper {
  private _wordGroup: {[key: string]: string[]}
  private _wordGroupMap: {[key: string]: string}

  public get wordGroupMap (): {[key: string]: string} {
    if (!this._wordGroupMap) {
      this._wordGroupMap = {}
      _.each(this.wordGroup, (val: string[], key) => _.each(val, x => this._wordGroupMap[x] = key))
    }
    return this._wordGroupMap
  }

  public get wordGroup (): {[key: string]: string[]} {
    if (!this._wordGroup) {
      let acronym = (short: string, long: string): string[] =>
        [short, long, `${short} (${long})`, `${long} (${short})`]
      this._wordGroup = {}
      this._wordGroup[uuid()] = [...acronym('tra', 'taiwan relations act'), ...acronym('tra', 'taiwan relation act')]
      this._wordGroup[uuid()] = [...acronym('wto', 'world trade organization')]
      this._wordGroup[uuid()] = [...acronym('icao', 'international civil aviation organization')]
      this._wordGroup[uuid()] = [...acronym('proc', 'people’s republic of china')]
      this._wordGroup[uuid()] = [...acronym('pla', 'people’s liberation army')]
    }
    return this._wordGroup
  }
}

let sync = new DropboxPaperToGoogleSheetSync()
sync.syncTags()
