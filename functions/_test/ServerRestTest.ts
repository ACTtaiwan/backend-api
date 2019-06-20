import 'mocha';
import * as chai from 'chai';
import { expect } from 'chai';
import * as _ from 'lodash';
import * as chaiAsPromised from 'chai-as-promised';
import * as request from 'supertest';
import { DataGraph } from '../../libs/dbLib2';
import { Express } from 'express';
import * as serverRest from '../server-rest';

describe.skip('ServerRouteTest', function () {
  this.timeout(20000);
  let app: Express;

  let inputs = {
    id: [
      '03d6f10b-40e8-44b1-ab36-0d69eef50274', // person
      'fc46042f-989f-49a8-8e00-a5d26c0c3ba1', // bill
      'fb9469f8-d30b-4215-a466-84c094dcf678', // bill
      'c167307e-ae0f-4a2f-a958-7f946848faa6', // person
      'f60aa515-a328-4e66-85b2-ac3197ba8fe5', // tag
      '3d1d9f5e-521f-4247-8136-2192fc1dfd35', // bill
      '597b8414-8f47-4c0b-85ab-0cc72e03ff56', // bill
      '8dd53af3-97a0-442a-9365-7bdd36bfe32d', // bill: tw travel act
    ],
  };

  class QueryString {
    public constructor (private _keyValuePairs: string[][] = []) {}

    public add (key: string, value: string | string[]) {
      if (_.isArray(value)) {
        _.each(value, v => this._keyValuePairs.push([key, v]));
      } else {
        this._keyValuePairs.push([key, value]);
      }
    }

    public toString (): string {
      return _.join(
        _.map(
          this._keyValuePairs,
          v => `${encodeURIComponent(v[0])}=${encodeURIComponent(v[1])}`
        ),
        '&'
      );
    }

    public async query (
      endpoint: string,
      printResults = true
    ): Promise<boolean> {
      let q = `${endpoint}?${this.toString()}`;
      // console.log(`GET ${q}`);
      let res = await request(app).get(q);
      if (res.error) {
        if (printResults) {
          console.log(res.error);
        }
        return false;
      } else {
        if (printResults) {
          console.dir(JSON.parse(res.text), { depth: null });
        }
        return true;
      }
    }
  }

  before(function () {
    chai.use(chaiAsPromised);
    app = serverRest.createApp();
  });

  beforeEach(function () {
    //
  });

  after(function () {
    DataGraph.cleanup();
  });

  it('/v2: load person', async function () {
    let qs = new QueryString();
    qs.add('id', inputs.id[0]);
    qs.add('field', [
      'firstName',
      // 'congressRoles#1141915600000',
      'congressRoles#current',
      'lastName',
      'lastName_zh',
    ]);
    // qs.add('lang', 'zh');
    let success = await qs.query('/v2');
    expect(success).to.be.true;
  });

  it('/v2: load bill', async function () {
    let qs = new QueryString();
    qs.add('id', inputs.id[1]);
    qs.add('field', ['title', 'cosponsors#date']);
    let success = await qs.query('/v2');
    expect(success).to.be.true;
  });

  it('/v2: load tag', async function () {
    let qs = new QueryString();
    qs.add('id', inputs.id[4]);
    qs.add('field', ['name']);
    let success = await qs.query('/v2');
    expect(success).to.be.true;
  });

  it('/v2: load multiple', async function () {
    let qs = new QueryString();
    qs.add('id', [
      inputs.id[1],
      // 'invalid-id',
      'fc46042f-989f-49a8-8e00-a5d26c0c3ba0', // invalid
      inputs.id[2],
    ]);
    qs.add('field', ['title', 'tags']);
    let success = await qs.query('/v2');
    expect(success).to.be.true;
  });

  it('/v2/bills by sponsor,tag', async function () {
    let qs = new QueryString();
    qs.add('congress', '116');
    qs.add('sponsorId', [inputs.id[0]]);
    qs.add('tagId', '5ec105d3-915b-4867-856a-b82dafaf7533');
    qs.add('field', ['congress', 'billType', 'billNumber', 'title', 'tags']);
    // qs.add('lang', 'zh');
    let success = await qs.query('/v2/bills');
    expect(success).to.be.true;
  });

  it('/v2/bills by multiple cosponsors', async function () {
    let qs = new QueryString();
    qs.add('congress', '116');
    qs.add('cosponsorId', [inputs.id[0], inputs.id[3]]);
    qs.add('field', ['congress', 'billType', 'billNumber', 'title', 'tags']);
    // qs.add('lang', 'zh');
    let success = await qs.query('/v2/bills');
    expect(success).to.be.true;
  });

  it('/v2/persons', async function () {
    let qs = new QueryString();
    qs.add('congress', '116');
    qs.add('state', 'WA');
    qs.add('district', ['1', '2']);
    // qs.add('chamber', 's');
    qs.add('field', ['firstName', 'lastName', 'congressRoles#current']);
    let success = await qs.query('/v2/persons');
    expect(success).to.be.true;
  });

  it('/v2/persons by billIds', async function () {
    let qs = new QueryString();
    qs.add('congress', '116');
    qs.add('state', ['OK', 'TX']);
    qs.add('billId', [inputs.id[5], inputs.id[6]]);
    qs.add('field', ['firstName', 'lastName']);
    let success = await qs.query('/v2/persons');
    expect(success).to.be.true;
  });

  it('/v2/article_snippets/ustw', async function () {
    let qs = new QueryString();
    qs.add('limit', '2');
    qs.add('before', '1559373800000');
    let success = await qs.query('/v2/article_snippets/ustw');
    expect(success).to.be.true;
  });

  it('/v2/article_snippets/act', async function () {
    let qs = new QueryString();
    qs.add('limit', '3');
    qs.add('before', '1560653000000');
    qs.add('field', 'headline');
    let success = await qs.query('/v2/article_snippets/act');
    expect(success).to.be.true;
  });
});
