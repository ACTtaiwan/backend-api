import * as _ from 'lodash';
import { CongressGovDataProvider } from './CongressGovDataProvider';
import { CongressGovHelper } from './CongressGovHelper';
import * as models from './CongressGovModels';

export class CongressGovTrackerParser {
  private dataProvider = new CongressGovDataProvider();

  public getTracker (billPath: string): Promise<models.Tracker[]> {
    if (!billPath) {
      return Promise.reject(new Error('invalid query. Example Usage: ?path=/bill/115th-congress/house-bill/4288'));
    }
    const url = CongressGovHelper.billPathToTextUrl(billPath);

    return new Promise((resolve, reject) => {
      console.log(`[CongressGovTrackerParser::getTracker()] ready to fetch url = ${url}`);
      this.dataProvider.fetchBillInfoHtml(url).then($ => {
        console.log(`[CongressGovTrackerParser::getTracker()] fetched done. Start parsing tracker`);
        const tr = this.parseTracker($);
        resolve(tr);
      }).catch(error => {
        reject(error);
      });
    });
  }

  private parseTracker ($: any): models.Tracker[] {
    let progress: any[] = $('ol.bill_progress > li');
    if (progress.length > 0) {
      console.log(`[CongressGovTrackerParser::parseTracker()] progress found. Length = ${progress.length}`);
      return _.map(progress, p => <models.Tracker> {
        stepName: p.children[0].data,
        selected: $(p).hasClass('selected')
      });
    }
    return [];
  }
}