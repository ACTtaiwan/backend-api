import 'mocha';
import 'chai';
import { Bill } from '../Bill';

describe('BillTest', async function () {
  it('t', async function () {
    let bill = new Bill();
    console.log(bill['_id']);
    console.log(bill['_type']);
  });
});