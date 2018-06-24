import { GoogleSheetAgent } from '../../libs/googleApi/GoogleSheetAgent'
import * as dbLib from '../../libs/dbLib'
import * as _ from 'lodash'
import { VersionRow } from '../../libs/googleApi/CongressSheetModels';
import { v4 as uuid } from 'uuid';

var awsConfig = require('../../config/aws.json');

export class GoogleVersionSheetSync {
  private readonly db = dbLib.DynamoDBManager.instance()

  private readonly tblName = (<any> awsConfig).dynamodb.VOLUNTEER_BILLVERSIONS_TABLE_NAME
  private readonly tbl = <dbLib.BillVersionTable> this.db.getTable(this.tblName)
  private versionMap: {[code: string]: dbLib.BillVersionEntity}

  private readonly sheet = new GoogleSheetAgent()

  public async init () {
    this.versionMap = _.keyBy(await this.tbl.getAllVersions(), 'code')
  }

  public async syncDb () {
    await this.init()
    const rows: VersionRow[] = await this.sheet.getVersionSheet()
    const versToUpdate: [VersionRow, dbLib.BillVersionEntity][] = []
    const versToAdd: VersionRow[] = []
    _.each(rows, row => {
      const ver = this.versionMap[row.abbr]
      if (ver) {
        versToUpdate.push([row, ver])
      } else {
        versToAdd.push(row)
      }
    })

    // update versions
    if (versToUpdate.length > 0) {
      console.log('Updating versions...')
      await this.updateVersions(versToUpdate)
    }
    console.log('\n\n')

    // add versions
    if (versToAdd.length > 0) {
      console.log('Adding versions...')
      await this.addVersions(versToAdd)
    }
    console.log('\n\n')
  }

  public async updateVersions (versToUpdate: [VersionRow, dbLib.BillVersionEntity][]): Promise<void> {
    for (let i = 0; i < versToUpdate.length; ++i) {
      const [row, entity] = versToUpdate[i]
      const update = this.convertRowToEntity(row)
      delete update.code // don't re-write code
      await this.tbl.updateVersion(entity.id, update)
      console.log(`UPDATED = ${JSON.stringify(update, null, 2)}\n`)
    }
  }

  public async addVersions (versToAdd: VersionRow[]): Promise<void> {
    for (let i = 0; i < versToAdd.length; ++i) {
      const row = versToAdd[i]
      const entity = this.convertRowToEntity(row)
      entity.id = uuid()
      await this.tbl.putVersion(entity)
      console.log(`ADDED = ${JSON.stringify(entity, null, 2)}\n`)
    }
  }

  private convertRowToEntity (row: VersionRow): dbLib.BillVersionEntity {
    const obj = <dbLib.BillVersionEntity> {}
    if (row.version) {
      obj.name = row.version.trim()
    }

    if (row.abbr) {
      obj.code = row.abbr.trim()
    }

    if (row.description) {
      obj.description = row.description.trim()
    }

    if (row.chambers) {
      const txt = row.chambers.toLowerCase().trim()
      const val: dbLib.BillVersionChamberType[] = []
      if (txt.includes('house')) {
        val.push('house')
      }
      if (txt.includes('senate')) {
        val.push('senate')
      }
      if (txt.includes('joint')) {
        val.push('joint')
      }
      if (val.length > 0) {
        obj.chamber = val
      }
    }
    return obj
  }
}

let sync = new GoogleVersionSheetSync()
sync.syncDb()
