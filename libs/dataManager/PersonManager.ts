import * as dbLib from '../../libs/dbLib'
import * as s3Lib from '../../libs/s3Lib'
import * as _ from 'lodash'
import * as fs from 'fs'
import { v4 as uuid } from 'uuid';
import { ProfilePictureResolution } from '../s3Lib';
import Utility from '../utils/Utility'

var awsConfig = require('../../config/aws.json');

export class PersonManager {
  private readonly db = dbLib.DynamoDBManager.instance()
  private readonly s3 = s3Lib.S3Manager.instance()

  private readonly tblBulkPpllName = (<any> awsConfig).dynamodb.BULK_PEOPLE_TABLE_NAME
  public  readonly tblBulkPpl = <dbLib.BulkPeopleTable> this.db.getTable(this.tblBulkPpllName)

  private readonly tblPpllName = (<any> awsConfig).dynamodb.VOLUNTEER_PERSON_TABLE_NAME
  public  readonly tblPpl = <dbLib.PersonTable> this.db.getTable(this.tblPpllName)

  private readonly bcktName = (<any> awsConfig).s3.TAIWANWATCH_PERSONS_BUCKET_NAME
  public  readonly bckt = <s3Lib.PersonBucket> this.s3.getBucket(this.bcktName)

  private bulkPplMap: {[key: string]: dbLib.BulkPeopleEntity}
  private twPplMap: {[key: string]: dbLib.PersonEntity}

  public async rebuildProfilePictures () {
    let pplItems: dbLib.PersonEntity[] = _.values(await this.getPersonMap())
    for (let i = 0; i < pplItems.length; ++i) {
      const item = pplItems[i]
      console.log(`\n-------------------- Updating ${i} / ${pplItems.length} --------------------\n`)
      await this.buildProfilePicture(item)
    }
  }

  public async importGovTrackData (folder: string) {
    const jsonFiles = fs.readdirSync(folder).filter(x => x.endsWith('.json'))
    const pplMap = await this.getPersonMap()
    let promises: Promise<any>[] = []

    let runPromises = async () => {
      if (promises.length > 0) {
        console.log(`PersonManager::importGovTrackData()] write to DB...`)
        await Promise.all(promises).then(() => promises = [])
      }
    }

    for (let i = 0; i < jsonFiles.length; ++i) {
      const fname = jsonFiles[i]
      console.log(`[PersonManager::importGovTrackData()] processing file = ${fname} (${i} / ${jsonFiles.length})`)
      const jsonObjs: any[] = JSON.parse(fs.readFileSync(folder + fname).toString()).objects
      for (let o = 0; o < jsonObjs.length; ++o) {
        console.log(`[PersonManager::importGovTrackData()] processing person (${o} / ${jsonObjs.length})`)
        let person = jsonObjs[o]
        let update = <dbLib.PersonEntity> {}
        let exist = pplMap[ this.queryKey(person.bioguideid, person.firstname, person.middlename, person.lastname) ]

        // The person's ID on bioguide.congress.gov. May be null if the person served only as a president and not in Congress.
        update.bioGuideId = (exist && exist.bioGuideId) || person.bioguideid

        // The person's ID on opensecrets.org (https://www.opensecrets.org/)
        update.osId = (exist && exist.osId) || person.osid

        // The person's ID on votesmart.org/ (https://votesmart.org/)
        update.pvsId = (exist && exist.pvsId) || person.pvsid

        // The ID of the person on CSPAN websites
        update.cspanId = (exist && exist.cspanId) || person.cspanid

        update.committeeAssignments = (exist && exist.committeeAssignments) || person.committeeassignments || []
        update.firstname = (exist && exist.firstname) || person.firstname
        update.lastname = (exist && exist.lastname) || person.lastname
        update.middlename = (exist && exist.middlename) || person.middlename
        update.nameMod = (exist && exist.nameMod) || person.namemod
        update.nickname = (exist && exist.nickname) || person.nickname

        if (update.firstname || update.middlename || update.lastname || update.nameMod || update.nickname) {
          update.searchName = `${update.firstname} ${update.middlename} ${update.lastname} / ${update.firstname} ${
            update.lastname
          } / ${update.lastname}, ${update.firstname} / ${update.nameMod} / ${update.nickname}`.toLowerCase()
        }

        update.birthday = (exist && exist.birthday) || person.birthday
        update.gender = (exist && exist.gender) || person.gender
        update.twitterId = (exist && exist.twitterId) || person.twitterId
        update.youtubeId = (exist && exist.youtubeId) || person.youtubeId
        update.govTrackId = (exist && exist.govTrackId) || person.id

        update = <dbLib.PersonEntity> _.pickBy(update, _.identity)
        update = <dbLib.PersonEntity> _.pickBy(update, (val, key) => exist ? !_.isEqual(exist[key], val) : true)

        if (!_.isEmpty) {
          update.lastUpdatedAt = new Date().getTime()
        }

        if (!exist) {
          update.id = <string> uuid()
          update.createdAt = new Date().getTime()
          console.log(`PersonManager::importGovTrackData()] CREATE = ${JSON.stringify(update, null, 2)}`)
          promises.push(this.tblPpl.putPerson(update))
        } else {
          console.log(`PersonManager::importGovTrackData()] UPDATE = ${JSON.stringify(update, null, 2)}`)
          promises.push(this.tblPpl.updatePerson(exist.id, update))
        }

        if (promises.length === 10) {
          await runPromises()
        }
      }
    }

    // clean up promises
    await runPromises()
  }

  public async buildProfilePicture (person: dbLib.PersonEntity) {
    if (person.govTrackId) {
      let displayText = this.queryKey(person.bioGuideId, person.firstname, person.middlename, person.lastname)
      console.log(`\n-------------------- Updating ${person.id} (${displayText}) --------------------\n`)
      let downloads: Promise<any>[] = []
      downloads.push(this.downloadProfilePictureFromGovTrack(person.govTrackId, '50px'))
      downloads.push(this.downloadProfilePictureFromGovTrack(person.govTrackId, '100px'))
      downloads.push(this.downloadProfilePictureFromGovTrack(person.govTrackId, '200px'))
      downloads.push(this.downloadProfilePictureFromGovTrack(person.govTrackId, 'origin'))

      console.log(`[PersonManager::buildProfilePicture()] downloading...`)
      let pics = await Promise.all(downloads)
      console.log(`[PersonManager::buildProfilePicture()] downloading... Done!`)

      let updateEntity = <dbLib.PersonEntity> {
        profilePictures: {}
      }

      console.log(`[PersonManager::buildProfilePicture()] uploading to S3...`)
      let s3Updates: Promise<any>[] = []
      let s3Prefix: string = person.id
      if (pics[0]) {
        s3Updates.push(this.bckt.putProfilePicture(s3Prefix, pics[0], '50px')
          .then(url => updateEntity.profilePictures['50px'] = url))
      }
      if (pics[1]) {
        s3Updates.push(this.bckt.putProfilePicture(s3Prefix, pics[1], '100px')
          .then(url => updateEntity.profilePictures['100px'] = url))
      }
      if (pics[2]) {
        s3Updates.push(this.bckt.putProfilePicture(s3Prefix, pics[2], '200px')
          .then(url => updateEntity.profilePictures['200px'] = url))
      }
      if (pics[3]) {
        s3Updates.push(this.bckt.putProfilePicture(s3Prefix, pics[2], 'origin')
          .then(url => updateEntity.profilePictures.origin = url))
      }

      if (s3Updates.length > 0) {
        await Promise.all(s3Updates)
      }
      console.log(`[PersonManager::buildProfilePicture()] uploading to S3... Done!`)

      if (!_.isEmpty(updateEntity)) {
        const jsonStr = JSON.stringify(updateEntity, null, 2)
        console.log(`[PersonManager::buildProfilePicture()] updating dynamoDb (id = ${person.id})\n${jsonStr}`)
        return await this.tblPpl.updatePerson(person.id, updateEntity)
      }
    } else {
      console.log(`[PersonManager::buildProfilePicture()] govTrackId not found = ${JSON.stringify(person, null, 2)}`)
    }
    return Promise.resolve()
  }

  public queryKey (bioGuideId?: string, firstName?: string, middleName?: string, lastName?: string): string {
    return bioGuideId || `${firstName}-${middleName}-${lastName}`
  }

  private async getBulkPeopleMap (): Promise<{[key: string]: dbLib.BulkPeopleEntity}> {
    if (!this.bulkPplMap) {
      const items = await this.tblBulkPpl.getAllPeople()
      this.bulkPplMap = _.keyBy(items, x => this.queryKey(x.bioguideid, x.firstname, x.middlename, x.lastname))
    }
    return this.bulkPplMap
  }

  private async getPersonMap (): Promise<{[key: string]: dbLib.PersonEntity}> {
    if (!this.twPplMap) {
      const items = await this.tblPpl.getAllPersons()
      this.twPplMap = _.keyBy(items, x => this.queryKey(x.bioGuideId, x.firstname, x.middlename, x.lastname))
    }
    return this.twPplMap
  }

  private async downloadProfilePictureFromGovTrack (govTrackId: number, res: ProfilePictureResolution): Promise<any> {
    const host: string = 'https://www.govtrack.us/data/photos/'
    const url: string = `${host}${govTrackId}${res === 'origin' ? '' : '-' + res}.jpeg`
    console.log(`[PersonManager::downloadProfilePictureFromGovTrack()] download url = ${url}`)
    return Utility.fetchUrlContent(url, true).catch(err => {
      console.log(`[PersonManager::downloadProfilePictureFromGovTrack()] download failed = ${JSON.stringify(err, null, 2)}`)
      return null
    })
  }
}

let mngr = new PersonManager()
// mngr.importGovTrackData('../taiwanwatch-govtrack-api-scraper/person/person-list/')
mngr.rebuildProfilePictures()

