import 'mocha';
import * as chai from 'chai';
import { expect } from 'chai';
import * as chaiAsPromised from 'chai-as-promised';
import * as _ from 'lodash';
import { IdHandler } from '../idHandler';
import { DataGraph } from '../../../../libs/dbLib2/DataGraph';
import { BillHandler } from '../BillHandler';

describe('HandlerTest', function () {
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
    ];
    let ids = [
      'fc46042f-989f-49a8-8e00-a5d26c0c3ba1',
      'fc46042f-989f-49a8-8e00-a5d26c0c3ba0',
      'fb9469f8-d30b-4215-a466-84c094dcf678',
    ];

    let res = await IdHandler.run(ids, fields);
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
    ];
    let congresses = [
      115,
      114,
    ];
    let sponsors = [
      '4f4afa81-b397-409e-8b55-91076a240534',
    ];
    let cosponsors = [
      '6db0dd58-4b07-4861-99b7-34aca6497cc8',
    ]
    let tags = [
      '425ea09b-cbaf-450b-bee6-be70b0a0f1ad',
    ]

    let res = await BillHandler.run(
      congresses,
      undefined,
      cosponsors,
      tags,
      fields
    );
    console.log(res);
  });
});