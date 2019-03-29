import 'mocha';
import * as chai from 'chai';
import * as chaiAsPromised from 'chai-as-promised';
import { IdHandler } from '../idHandler';
import { DataGraph } from '../../../../libs/dbLib2/DataGraph';
import { BillHandler } from '../BillHandler';
import { PersonHandler } from '../PersonHandler';
import { ArticleSnippetHandler } from '../ArticleSnippetHandler';
import { Site } from '../handlers';

describe('HandlerTest', function () {
  this.timeout(15000);

  before(function () {
    chai.use(chaiAsPromised);
  });

  beforeEach(function () {
    //
  });

  after(function () {
    DataGraph.cleanup();
  });

  it.skip('id', async function () {
    let fields = [
      '_id',
      'congress',
      'billType',
      'billNumber',
      'sponsors',
      'cosponsors',
      'tags',
      'title',
      'summary',
      'name',
      'name_zh',
      'firstName',
      'lastName',
    ];
    let ids = [
      'fc46042f-989f-49a8-8e00-a5d26c0c3ba1',
      'fc46042f-989f-49a8-8e00-a5d26c0c3ba0',
      'fb9469f8-d30b-4215-a466-84c094dcf678',
      '56a3f0d7-3945-4912-9199-dc86183fa4c6',
      'c167307e-ae0f-4a2f-a958-7f946848faa6',
    ];

    let res = await IdHandler.run(ids, fields, 'zh');
    console.log(res);
  });

  it.skip('bills', async function () {
    let fields = [
      '_id',
      'congress',
      'billType',
      'billNumber',
      'sponsors',
      'cosponsors',
      'tags',
      'title',
    ];
    let congresses = [
      115,
      114,
    ];
    // let sponsors = [
    //   '4f4afa81-b397-409e-8b55-91076a240534',
    // ];
    let cosponsors = [
      '6db0dd58-4b07-4861-99b7-34aca6497cc8',
    ];
    let tags = [
      '425ea09b-cbaf-450b-bee6-be70b0a0f1ad',
    ];

    let res = await BillHandler.run(
      congresses,
      undefined,
      cosponsors,
      tags,
      fields,
      'zh',
    );
    console.log(res);
  });

  it.skip('persons', async function () {
    let fields = [
      '_id',
      'firstName',
      'middleName',
      'lastName',
      'bioGuideId',
      // 'congressRoles',
      'congressRoles.congressNumbers',
      'congressRoles.state',
      'congressRoles.district',
      'sponsoredBills',
      'cosponsoredBills',
    ];
    let congresses = [
      115,
      // 114,
    ];
    let states = [
      'WA',
      'MD',
    ];
    // let districts = [
    //   1,
    // ];
    let billIds = [
      '15a2ed64-13a6-4b2a-8c8f-2ecd6b99e28e',
      '1d294066-28b8-4e64-bb95-cbe97ea968bb',
    ];

    let res = await PersonHandler.run(
      congresses,
      states,
      undefined,
      billIds,
      fields,
      'zh',
    );
    console.dir(res, { depth: null });
  });

  it.skip('article_snippets', async function () {
    let fields = [
      'headline',
    ];
    let site = [
      'act',
    ];
    let before = [
      1536861600000,
    ];
    let limit = [
      5,
    ];

    let res = await ArticleSnippetHandler.run(
      <Site>site[site.length - 1],
      before[before.length - 1],
      limit[limit.length - 1],
      fields,
    );
    console.dir(res, { depth: null });
  });
});