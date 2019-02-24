import * as _ from 'lodash';
import { CongressGovDataProvider } from './CongressGovDataProvider';
import { CongressGovHelper } from './CongressGovHelper';
import * as models from './CongressGovModels';
import Utility from '../utils/Utility';

export class CongressGovAllInfoParser {
  private dataProvider = new CongressGovDataProvider();

  public getAllInfo (billPath: string): Promise<models.CongressGovAllInfo> {
    if (!billPath) {
      return Promise.reject(new Error('invalid query. Example Usage: ?path=/bill/115th-congress/house-bill/4288'));
    }
    const url = CongressGovHelper.billPathToAllInfoUrl(billPath);

    return new Promise((resolve, reject) => {
      console.log(`[CongressGovAllInfoParser::getAllInfo()] ready to fetch url = ${url}`);
      this.dataProvider.fetchBillAllInfoHtml(url).then($ => {
        console.log(`[CongressGovAllInfoParser::getAllInfo()] fetched done. Start parsing all`);
        let obj = this.parseAll($);
        console.log(`[CongressGovAllInfoParser::getAllInfo()] Parse done`);
        resolve(obj);
      }).catch(error => {
        reject(error);
      });
    });
  }

  private parseAll ($: any): models.CongressGovAllInfo {
    let titles = this.parseTitles($);
    let actionsOverview = this.parseActions('#actionsOverview-content tbody tr', $);
    let actionsAll = this.parseActions('#allActions-content tbody tr', $);
    let cosponsors = this.parseCosponsor($);
    let committees = this.parseCommittees($);
    let relatedBills = this.parseRelatedBills($);
    let subjects = this.parseSubjects($);
    let summaryAll = this.parseSummary('#allSummaries-content', $);
    let summaryLatest = this.parseSummary('#latestSummary-content', $)[0] || undefined;
    return { titles, actionsOverview, actionsAll, cosponsors, committees, relatedBills, subjects, summaryAll, summaryLatest };
  }

  private parseTitles ($: any): models.CongressGovTitleInfo {
    let obj = <models.CongressGovTitleInfo> {};
    let titleNode = $('#titles-content');
    if (titleNode && titleNode.length === 1) {
      titleNode = $(titleNode[0]);

      // short titles - enacted
      let enacted = titleNode.find(`h4:contains('Enacted') + p`);
      let enactedTxt = (enacted
                    && (enacted.length === 1)
                    && enacted[0].children
                    && enacted[0].children[0]
                    && enacted[0].children[0].data) || undefined;
      if (enactedTxt) {
        obj.enactedTitle = {
          type: 'Enacted',
          text: enactedTxt
        };
      }

      // short titles
      obj.shortTitles = {
        house: [],
        senate: []
      };
      let shortTitlesHouse = $('#titles-content #titles_main > .titles-row .house-column .header').siblings();
      if (shortTitlesHouse.length > 0) {
        obj.shortTitles.house = this.parseTitleEntities(shortTitlesHouse, /Short Titles as|Short Title as/gi, $);
      }

      let shortTitlesSenate = $('#titles-content #titles_main > .titles-row .senate-column .header').siblings();
      if (shortTitlesSenate.length > 0) {
        obj.shortTitles.senate = this.parseTitleEntities(shortTitlesSenate, /Short Titles as|Short Title as/gi, $);
      }

      // official titles
      let officialTitles = $('#titles-content #titles_main > .officialTitles .header').siblings();
      if (officialTitles.length > 0) {
        let x = this.parseTitleEntities(officialTitles, /Official Titles as|Official Title as/gi, $);
        if (x.length === 1) {
          obj.officialTitle = x[0];
        }
      }

    }
    return obj;
  }

  private parseTitleEntities (titleNodes: any, typeTrimPattern: RegExp, $: any): models.CongressGovTitle[] {
    let rtn = [];
    let titleEntity: models.CongressGovTitle;
    _.each(titleNodes, node => {
      if (node.tagName === 'h4') {
        if (titleEntity) {
          rtn.push(titleEntity);
        }
        const type = $(node).text().replace(typeTrimPattern, '').trim();
        if (type && type.length > 0) {
          titleEntity = <models.CongressGovTitle> { type };
        }
      }

      if (node.tagName === 'h5' && !titleEntity) {
        const type = $(node).text().replace(typeTrimPattern, '').replace('for portions of this bill', '').trim();
        if (type && type.length > 0) {
          titleEntity = <models.CongressGovTitle> { type };
        }
      }

      if (node.tagName === 'p') {
        const text = $(node).text().trim();
        if (text && text.length > 0 && titleEntity) {
          titleEntity.text = text;
        }
      }

      if (node.tagName === 'ul' && titleEntity) {
        let items = $(node).find('li');
        if (items.length > 0) {
          titleEntity.titlesAsPortions = [];
          _.each(items, node => {
            const text = $(node).text();
            if (text && text.length > 0) {
              titleEntity.titlesAsPortions.push(text);
            }
          });
        }
      }
    });

    if (titleEntity) {
      rtn.push(titleEntity);
    }

    return rtn;
  }

  private parseActions (selector: string, $: any): models.CongressGovAction[] {
    let actions = [];
    let items = $(selector);
    _.each(items, item => {
      item = $(item);
      let dateNode = item.find('td.date');
      let date = (dateNode.length === 1) && dateNode[0].children && dateNode[0].children[0] && dateNode[0].children[0].data;
      date = (date && Utility.parseDateTimeStringAtEST(date).getTime()) || undefined;

      let descNode = item.find('td.actions').html();
      let description = descNode && descNode.trim();

      let actObj = <models.CongressGovAction> {
        datetime: date,
        description
      };

      let chamberNode = item.find('td.date + td').text();
      let chamber = chamberNode && chamberNode.trim();
      switch (chamber) {
        case 'Senate':
          actObj.chamber = 'senate';
          break;
        case 'House':
          actObj.chamber = 'house';
          break;
      }

      actions.push(actObj);
    });
    return actions;
  }

  private parseCosponsor ($: any): models.CongressGovCoSponsor[] {
    let cosponsors: models.CongressGovCoSponsor[] = [];
    let items = $('#cosponsors-content tbody tr');
    _.each(items, item => {
      item = $(item);
      let spnsrNode = item.find('td.actions > a');
      let cosponsor = this.parseSponsor(spnsrNode);

      let dateNode = item.find('td.date');
      let date = (dateNode.length === 1) && dateNode[0].children && dateNode[0].children[0] && dateNode[0].children[0].data;
      date = (date && Utility.parseDateTimeStringAtEST(date).getTime()) || undefined;

      let obj = <models.CongressGovCoSponsor> {};

      if (cosponsor) {
        obj.cosponsor = cosponsor;
      }

      if (date) {
        obj.dateCosponsored = date;
      }

      if (!_.isEmpty(obj)) {
        cosponsors.push(obj);
      }
    });
    return cosponsors;
  }

  private parseSponsor (nodes: any): models.CongressGovSponsor {
    if (nodes && nodes.length === 1 && nodes[0].attribs && nodes[0].attribs.href) {
      let path: string = nodes[0].attribs.href;
      let congressGovUrl = path && CongressGovHelper.pathToFullUrl(path);
      let bioGuideId = path.split('/').pop();
      let name = nodes[0].children[0].data || '';
      return {congressGovUrl, bioGuideId, name};
    }
    return null;
  }

  private parseCommittees ($: any): models.CongressGovCommitteeActivity[] {
    let committees: models.CongressGovCommitteeActivity[] = [];

    const parseItemNameAndChamber = (node): models.CongressGovCommitteeActivity => {
      let nodes = $(node).find('th');
      let fullname = nodes && nodes[0] && nodes[0].children && nodes[0].children[0] && nodes[0].children[0].data;
      if (fullname) {
        let obj = <models.CongressGovCommitteeActivity> { fullname };

        // parse chamber
        if (obj.fullname) {
          if (obj.fullname.toLowerCase().startsWith('house')) {
            obj.chamber = 'house';
          } else if (obj.fullname.toLowerCase().startsWith('senate')) {
            obj.chamber = 'senate';
          }
        }
        return obj;
      }
      return null;
    };

    const parseItemRecord = (node): models.CongressGovCommitteeRecord => {
      let nodes = $(node).find('td');
      if (nodes && nodes.length >= 2) {
        let text = _.map(nodes, (n: any) => $(n).text().trim());
        let obj = <models.CongressGovCommitteeRecord> {};
        if (text && text[0]) {
          obj.date = Utility.parseDateTimeStringAtEST(text[0]).getTime();
        }
        if (text && text[1]) {
          obj.activity = text[1];
        }
        return (!_.isEmpty(obj) && obj) || null;
      }
      return null;
    };

    let nodes = $('#committees-content tbody tr');
    let item: models.CongressGovCommitteeActivity;
    type CommitteeRowType = 'committee' | 'subcommittee' | 'record';
    let currentItem: models.CongressGovCommitteeActivity;
    _.each(nodes, node => {
      const currentType: CommitteeRowType = (node.attribs && node.attribs.class) || 'record';
      switch (currentType) {
        case 'committee':
          if (item) {
            committees.push(item);
          }
          item = parseItemNameAndChamber(node);
          const itemRecord = parseItemRecord(node);
          if (itemRecord) {
            item.records = [itemRecord];
          } else {
            item.records = [];
          }
          currentItem = item;
          break;

        case 'subcommittee':
          const subItem = parseItemNameAndChamber(node);
          if (subItem) {
            const subItemRecord = parseItemRecord(node);
            if (subItemRecord) {
              subItem.records = [subItemRecord];
            } else {
              subItem.records = [];
            }
            item.subcommittees = [...item.subcommittees || [], subItem];
            currentItem = subItem;
          } else {
            currentItem = null;
          }
          break;

        case 'record':
          const record = parseItemRecord(node);
          if (currentItem) {
            currentItem.records = [...currentItem.records || [], record];
          }
      }
    });

    if (item) {
      committees.push(item);
    }

    return committees;
  }

  private parseRelatedBills ($: any): models.CongressGovBill[] {
    const bills: models.CongressGovBill[] = [];
    const nodes = $(`#relatedBills-content tbody > tr a[href^='${CongressGovHelper.CONGRESS_GOV_HOST}']`);
    _.each(nodes, node => {
      let href = node.attribs && node.attribs.href;
      if (href) {
        let bill = CongressGovHelper.parseBillUrlOrPath(href);
        bills.push(bill);
      }
    });
    return bills;
  }

  private parseSubjects ($: any): string[] {
    const subjects: string[] = [];
    const nodes = $('#subjects-content #main li');
    _.each(nodes, node => {
      const text = $(node).text();
      if (text) {
        subjects.push(text);
      }
    });
    return subjects;
  }

  private parseSummary (htmlIdSelector: string, $: any): models.CongressGovSummary[] {
    let summaryAll: models.CongressGovSummary[] = [];
    let node = $(`${htmlIdSelector} #bill-summary h3.currentVersion`).first();
    let item: models.CongressGovSummary;
    while (node && node.length > 0) {
      if (node[0].tagName.toLowerCase() === 'h3' && node.text().startsWith('Shown Here')) {
        if (item) {
          summaryAll.push(item);
        }
        const spans = node.find('span');
        let title: string = '';
        _.each(spans, s => {
          let text = $(s).text();
          title = text || title;
        });
        item = <models.CongressGovSummary> { title };
      } else {
        const html = node.html().trim();
        if (html) {
          item.paragraphs = [...item.paragraphs || [], html];
        }
      }
      node = node.next();
    }

    if (item) {
      summaryAll.push(item);
    }

    return summaryAll;
  }
}
