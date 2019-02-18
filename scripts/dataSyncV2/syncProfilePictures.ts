import * as dbLib2 from '../../libs/dbLib2';
import * as s3Lib from '../../libs/s3Lib';
import * as _ from 'lodash';
import { CongressGovMemberParser } from '../../libs/congressGov/CongressGovMemberParser';
import Utility from '../../libs/utils/Utility';
import * as sharp from 'sharp';

var awsConfig = require('../../config/aws.json');

export class ProfilePictureSync {
  private readonly s3 = s3Lib.S3Manager.instance();
  private readonly bcktName = (<any> awsConfig).s3.TAIWANWATCH_PERSONS_BUCKET_NAME;
  private readonly bckt = <s3Lib.PersonBucket> this.s3.getBucket(this.bcktName);
  private readonly congressGov = new CongressGovMemberParser();
  private readonly logger = new dbLib2.Logger('ProfilePictureSync');
  private g: dbLib2.IDataGraph;

  public async init () {
    this.g = await dbLib2.DataGraph.getDefault();
  }

  public async buildProfilePictureForCongress (congress: number) {
    const fLog = this.logger.in('buildProfilePictureForCongress');
    const entQuery: dbLib2.IEntQuery<dbLib2.IEntPerson> = {
      _type: dbLib2.Type.Person,
      congressRoles: {
        _op: 'has_any',
        _val: {
          congressNumbers: congress
        }
      }
    };
    const m = <dbLib2.IEntPerson[]> await this.g.findEntities(entQuery);
    fLog.log(`Found ${m.length} members in congress ${congress}`);

    for (let i = 0; i < m.length; ++i) {
      fLog.log(`-------------- Building member ${i} / ${m.length - 1} (bioGuideId = ${m[i].bioGuideId}) --------------`);
      await this.buildProfilePicture(m[i]);
      fLog.log(`Done member ${m[i].bioGuideId}\n\n`);
    }
  }

  public async buildProfilePictureForMember (id: string) {
    const fLog = this.logger.in('buildProfilePictureByMemberId');
    let m = <dbLib2.IEntPerson[]> await this.g.findEntities({
      _type: dbLib2.Type.Person,
      _id: id
    });
    if (m && m[0]) {
      await this.buildProfilePicture(m[0]);
    } else {
      fLog.log(`Can not find member ${id}`);
    }
  }

  public async buildProfilePicture (m: dbLib2.IEntPerson, batchUpdate?: dbLib2.IEntPerson[]) {
    const fLog = this.logger.in('buildProfilePicture');
    if (!m.bioGuideId) {
      fLog.log(`bioGuideId not found for member ${m._id}`);
      return;
    }

    const s3Prefix: string = m._id;

    const s3Checks: Promise<any>[] = [
      this.bckt.hasProfilePicture(s3Prefix, 'origin'),
      this.bckt.hasProfilePicture(s3Prefix, '200px'),
      this.bckt.hasProfilePicture(s3Prefix, '100px'),
      this.bckt.hasProfilePicture(s3Prefix, '50px')
    ];
    const exists = await Promise.all(s3Checks);
    const hasAllPics = _.every(exists);

    let profilePictures: dbLib2.IEntPersonProfilePicture = {};

    if (hasAllPics) {
      fLog.log(`Pics exist for all resolutions. Skip prearing pictures.`);
      profilePictures = {
        origin: this.bckt.getUrl(s3Prefix, 'origin'),
        '200px': this.bckt.getUrl(s3Prefix, '200px'),
        '100px': this.bckt.getUrl(s3Prefix, '100px'),
        '50px': this.bckt.getUrl(s3Prefix, '50px')
      };
    } else {
      fLog.log(`Pics missing. Prearing pictures...`);
      const pics = await this.prepareProfilePictures(m.bioGuideId);
      fLog.log(`Pics missing. Prearing pictures...Done!`);

      const s3Updates: Promise<any>[] = [];

      if (pics['50px']) {
        s3Updates.push(
          this.bckt.putProfilePicture(s3Prefix, pics['50px'], '50px')
          .then(url => profilePictures['50px'] = url));
      }

      if (pics['100px']) {
        s3Updates.push(
          this.bckt.putProfilePicture(s3Prefix, pics['100px'], '100px')
          .then(url => profilePictures['100px'] = url));
      }

      if (pics['200px']) {
        s3Updates.push(
          this.bckt.putProfilePicture(s3Prefix, pics['200px'], '200px')
          .then(url => profilePictures['200px'] = url));
      }

      if (pics.origin) {
        s3Updates.push(
          this.bckt.putProfilePicture(s3Prefix, pics.origin, 'origin')
          .then(url => profilePictures.origin = url));
      }

      if (s3Updates.length > 0) {
        fLog.log(`uploading to S3...`);
        await Promise.all(s3Updates);
        fLog.log(`uploading to S3... Done!`);
      }
    }

    const shouldUpdate =
         !m.profilePictures
      || !_.isEqual(profilePictures, m.profilePictures);

    if (shouldUpdate) {
      fLog.log(`uploading DB...`);
      const update: Partial<dbLib2.IEntPerson> = {
        _type: dbLib2.Type.Person,
        _id: m._id,
        profilePictures
      };
      batchUpdate
        ? batchUpdate.push(update as dbLib2.IEntPerson)
        : await this.g.updateEntities([update as dbLib2.IEntPerson]);
      fLog.log(`uploading DB...Done!`);
    }
  }

  private async prepareProfilePictures (bioGuideId: string): Promise<{[res in s3Lib.ProfilePictureResolution]?: Buffer}> {
    const fLog = this.logger.in('buildProfilePicture');
    const origin = await this.downloadProfilePicture(bioGuideId);
    if (!origin) {
      fLog.log(`Can not find profile pictures on congress.gov. bioGuideId = ${bioGuideId}`);
      return {};
    }

    const promises = [
      this.resizePicture(origin, 200),
      this.resizePicture(origin, 100),
      this.resizePicture(origin, 50)
    ];
    const pics = await Promise.all(promises);
    return {
      origin,
      '200px': pics[0],
      '100px': pics[1],
      '50px': pics[2],
    };
  }

  private async downloadProfilePicture (bioGuideId: string): Promise<Buffer> {
    const url = await this.congressGov.getProfilePictureUrl(bioGuideId);
    if (!url) {
      return undefined;
    }

    const pic: Buffer = await Utility.fetchUrlContent(url, true);
    return pic;
  }

  private async resizePicture (pic: Buffer, size: number): Promise<Buffer> {
    const buf: Buffer = await sharp(pic).resize(size).toBuffer();
    return buf;
  }
}

// let s = new ProfilePictureSync();
// s.init().then(() => s.buildProfilePictureForMember('a7265cef-5aaf-4d5a-9116-63dfde31c3e4'));
// s.init().then(() => s.buildProfilePictureForCongress(116));