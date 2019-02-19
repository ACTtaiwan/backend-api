import * as _ from 'lodash';
import * as aws from 'aws-sdk';
import * as google from 'googleapis';
import * as models from './CongressSheetModels';

class GoogleApiAuth {
  private static readonly SCOPES = ['https://www.googleapis.com/auth/spreadsheets'];
  private static jwtAuth: any;

  public static get auth (): Promise<any> {
    if (!GoogleApiAuth.jwtAuth || (GoogleApiAuth.jwtAuth && GoogleApiAuth.isAboutExpired())) {
      console.log(`[GoogleApiAuth::auth()] new a jwt auth`);
      return GoogleApiAuth.getKeyFileFromS3().then(key => GoogleApiAuth.updateJwtAuth(key));
    } else {
      console.log(`[GoogleApiAuth::auth()] return existing jwt auth`);
      return Promise.resolve(GoogleApiAuth.jwtAuth);
    }
  }

  private static isAboutExpired (): boolean {
    if (!GoogleApiAuth.jwtAuth) {
      return true;
    } else {
      let expiryDate = GoogleApiAuth.jwtAuth.expiry_date;
      let currData = new Date().getTime();
      let driftInMs = 10 * 1000; // 10 mins
      let aboutExpired = currData + driftInMs >= expiryDate;
      console.log(`[GoogleApiAuth::isAboutExpired()] aboutExpired = ${aboutExpired}`);
      return aboutExpired;
    }
  }

  private static getKeyFileFromS3 (): Promise<any> {
    return new Promise((resolve, reject) => {
      let s3 = new aws.S3();
      var params = {
        Bucket: 'taiwanwatch-credentials',
        Key: 'google-api/googl-sheet-api-keyfile.json'
       };
      console.log(`[GoogleApiAuth::getKeyFileFromS3()] requesting S3`);
      s3.getObject(params, (err, data) => {
        if (err) {
          console.log(`[GoogleApiAuth::getKeyFileFromS3()] Error = ${JSON.stringify(err, null, 2)}`);
          reject(err);
        } else {
          console.log(`[GoogleApiAuth::getKeyFileFromS3()] OK. data = ${JSON.stringify(data, null, 2)}`);
          try {
            let json = JSON.parse(data.Body.toString());
            console.log(`[GoogleApiAuth::getKeyFileFromS3()] JSON parse done`);
            resolve(json);
          } catch (e) {
            console.log(`[GoogleApiAuth::getKeyFileFromS3()] JSON parse failed. Error = ${e}`);
            reject(e);
          }
        }
      });
    });
  }

  private static updateJwtAuth (key: any): Promise<any> {
    return new Promise((resolve, reject) => {
      console.log(`[GoogleApiAuth::updateJwtAuth()] start with key = ${JSON.stringify(key, null, 2)}`);
      var jwtClient = new google.auth.JWT(
        key.client_email,
        null,
        key.private_key,
        GoogleApiAuth.SCOPES,
        null
      );

      console.log(`[GoogleApiAuth::updateJwtAuth()] jwtClient.authorize()`);
      jwtClient.authorize((err, tokens) => {
        if (err) {
          console.log(`[GoogleApiAuth::updateJwtAuth()] Failed. Error = ${JSON.stringify(err, null, 2)}`);
          return reject(err);
        } else {
          console.log(`[GoogleApiAuth::updateJwtAuth()] OK. jwtClient = ${JSON.stringify(jwtClient, null, 2)}`);
          GoogleApiAuth.jwtAuth = jwtClient;
          resolve(GoogleApiAuth.jwtAuth);
        }
      });
    });
  }
}

export abstract class GoogleSheetAgentBase {
  private readonly sheets = google.sheets('v4');
  private readonly spreadsheetId: string;
  private auth: any;

  constructor (spreadId: string) {
    this.spreadsheetId = spreadId;
  }

  public queryRange (q: string): Promise<any> {
    return this.getAuth().then(auth => new Promise((resolve, reject) => {
      this.sheets.spreadsheets.values.get({
        auth: auth,
        spreadsheetId: this.spreadsheetId,
        range: q
      }, (err, response) => {
        if (err) {
          reject(err);
        } else {
          resolve(response);
        }
      });
    }));
  }

  public updateRange (r: string, values: string[][]): Promise<any> {
    var body = {
      values: values
    };
    return this.getAuth().then(auth => new Promise((resolve, reject) => {
      this.sheets.spreadsheets.values.update({
        auth: auth,
        spreadsheetId: this.spreadsheetId,
        range: r,
        resource: body,
        valueInputOption: 'USER_ENTERED'
      }, (err, response) => {
        if (err) {
          reject(err);
        } else {
          resolve(response);
        }
      });
    }));
  }

  private getAuth (): Promise<any> {
    if (this.auth) {
      return Promise.resolve(this.auth);
    } else {
      return GoogleApiAuth.auth.then(auth => {
        this.auth = auth;
        return auth;
      });
    }
  }
}

export class GoogleSheetAgent extends GoogleSheetAgentBase {

  constructor () {
    super('147cXhAFUyrNENCk6CAW7El1SbpfAXYfQICNyVKbBrSQ');
  }

  public getBillSheet (): Promise<models.BillRow[]> {
    const convert = (row: any[]): models.BillRow => {
      const bill: models.BillRow = {};
      row[0] && (bill.congress = parseInt(row[0]));
      row[1] && (bill.billTypeDisplay = row[1]);
      row[2] && (bill.billNumber = parseInt(row[2]));
      row[3] && (bill.title = row[3]);
      row[4] && (bill.title_zh = row[4]);
      row[5] && (bill.versionCode = row[5]);
      row[6] && (bill.categories = _.map((<string> row[6]).split(','), x => x.trim()));
      row[7] && (bill.tags = _.map((<string> row[7]).split(','), x => x.trim()));
      row[8] && (bill.relevence = parseInt(row[8]));
      row[9] && (bill.china = row[9]);
      row[10] && (bill.insight = row[10]);
      row[11] && (bill.comment = row[11]);
      return bill;
    };
    return this.queryRange('bills!3:99999').then(data =>
      (data.values) ? _.map(data.values, (row: any[]) => convert(row)) : []
    );
  }

  public getTagSheet (): Promise<models.TagRow[]> {
    const convert = (row: any[]): models.TagRow => {
      const tag: models.TagRow = {};
      row[0] && (tag.tag = row[0]);
      row[1] && (tag.type = row[1]);
      row[2] && (tag.contributor = row[2]);
      row[3] && (tag.comment = row[3]);
      return tag;
    };
    return this.queryRange('tags!3:99999').then(data =>
      (data.values) ? _.map(data.values, (row: any[]) => convert(row)) : []
    );
  }

  public getCategorySheet (): Promise<models.CategoryRow[]> {
    const convert = (row: any[]): models.CategoryRow => {
      const tag: models.CategoryRow = {};
      row[0] && (tag.displayName = row[0]);
      row[1] && (tag.code = row[1]);
      row[2] && (tag.contributor = row[2]);
      row[3] && (tag.comment = row[3]);
      return tag;
    };
    return this.queryRange('categories!3:99999').then(data =>
      (data.values) ? _.map(data.values, (row: any[]) => convert(row)) : []
    );
  }

  public getVersionSheet (): Promise<models.VersionRow[]> {
    const convert = (row: any[]): models.VersionRow => {
      const ver: models.VersionRow = {};
      row[0] && (ver.version = row[0]);
      row[1] && (ver.abbr = row[1]);
      row[2] && (ver.description = row[2]);
      row[3] && (ver.chambers = row[3]);
      return ver;
    };
    return this.queryRange('versions!3:99999').then(data =>
      (data.values) ? _.map(data.values, (row: any[]) => convert(row)) : []
    );
  }

  public rewriteBillSheetCategoryColumn (rows: models.BillRow[]): Promise<void> {
    let values: string[][] = [];
    _.each(rows, row => values.push([
      (row.categories && row.categories.join(', ')) || ''
    ]));

    let startCol = 'G';
    let rowShift = 3;
    let range = `bills!${startCol}${rowShift}:${startCol}99999`;

    return this.updateRange(range, values);
  }

  public rewriteBillSheetTagsColumn (rows: models.BillRow[]): Promise<void> {
    let values: string[][] = [];
    _.each(rows, row => values.push([
      (row.tags && row.tags.join(', ')) || ''
    ]));

    let startCol = 'H';
    let rowShift = 3;
    let range = `bills!${startCol}${rowShift}:${startCol}99999`;

    return this.updateRange(range, values);
  }

  public rewriteTagSheet (rows: models.TagRow[]): Promise<void> {
    let values: string[][] = [];
    _.each(rows, row => values.push([
      row.tag || '',
      row.type || '',
      row.contributor || '',
      row.comment || '']
    ));

    let numAttrs: number = (values && values[0] && values[0].length) || 0;
    let startCol = 'A';
    let endCol = String.fromCharCode(startCol.charCodeAt(0) + numAttrs);
    let rowShift = 3;
    let range = `tags!${startCol}${rowShift}:${endCol}99999`;

    return this.updateRange(range, values);
  }
}

export class MiguelCategorySheetAgent extends GoogleSheetAgentBase {
  constructor () {
    super('16gNeM-zSrm4iw4dE_rft7NQ4DPBGcWlosXguhvGWug4');
  }

  public getSheet (): Promise<models.MiguelCategoryRow[]> {
    const convert = (row: any[]): models.MiguelCategoryRow => {
      const cat = <models.MiguelCategoryRow> {};
      row[0] && (cat.congress = parseInt(row[0]));
      if (row[1]) {
        cat.billNumber = parseInt( (row[1].match(/[0-9].*/) || [])[0]);
        cat.billTypeDisplay = row[1].replace(cat.billNumber.toString(), '').trim();
      }
      row[2] && (cat.title = row[2]);
      row[3] && (cat.appropriation = parseInt(row[3]) === 1);
      row[4] && (cat.arms = parseInt(row[4]) === 1);
      row[5] && (cat.sales = parseInt(row[5]) === 1);
      row[6] && (cat.transfer = parseInt(row[6]) === 1);
      row[7] && (cat.democracy = parseInt(row[7]) === 1);
      row[8] && (cat.internationalSpace = parseInt(row[8]) === 1);
      row[9] && (cat.internationalOrganization = parseInt(row[9]) === 1);
      row[10] && (cat.us = parseInt(row[10]) === 1);
      row[11] && (cat.other = parseInt(row[11]) === 1);
      row[12] && (cat.taiwanDefense = parseInt(row[12]) === 1);
      row[13] && (cat.usTaiwanRelation = parseInt(row[13]) === 1);
      row[14] && (cat.office = parseInt(row[14]) === 1);
      row[15] && (cat.tra = parseInt(row[15]) === 1);
      row[16] && (cat.trade = parseInt(row[16]) === 1);
      return cat;
    };
    return this.queryRange('Sheet1!2:99999').then(data =>
      (data.values) ? _.map(data.values, (row: any[]) => convert(row)) : []
    );
  }
}
