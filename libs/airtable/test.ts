import * as airtable from './';
import * as strftime from 'strftime';
import * as checksum from 'checksum';

async function test () {
  let m = await airtable.Manager.new('appr4yE8zg0gz6OWt');
  let bills = await m.list(
    'Bill',
    // ['congress', 'bill type', 'bill number', 'last sync time'],
    null,
    '{bill id} = \'[115] H.R. 3362\'',
    2,
  );
  console.log('-----------');
  console.log(bills);

  // // swap bill type
  // console.log('-----------');
  // console.log(bills[0].get('bill type')[0].get('Name'));
  // console.log(bills[1].get('bill type')[0].get('Name'));
  // let billType0 = bills[0].get('bill type')[0];
  // let billType1 = bills[1].get('bill type')[0];
  // let contributor = bills[0].get('contributor')[0];
  // bills[0].set('bill type', billType1);
  // bills[1].set('bill type', billType0);
  // console.log('-----------');
  // console.log(bills[0].get('bill type')[0].get('Name'));
  // console.log(bills[1].get('bill type')[0].get('Name'));

  console.log(checksum(bills[0].toString()));
  let utcDateStr = strftime.timezone(0)('%Y-%m-%dT%H:%M:%S.000Z');
  bills[0].set('last sync time', utcDateStr);
  console.log(checksum(bills[0].toString()));
  await bills[0].save();
}

test().then();
