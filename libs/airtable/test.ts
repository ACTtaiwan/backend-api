import * as airtable from './'

async function test () {
  let m = await airtable.Manager.new('appp9kTQYOdrmDGuS');
  let bills = await m.list('Bill', 2);
  console.log('-----------');
  console.log(bills);

  // swap bill type
  console.log('-----------');
  console.log(bills[0].get('bill type')[0].get('Name'));
  console.log(bills[1].get('bill type')[0].get('Name'));
  let billType0 = bills[0].get('bill type')[0];
  let billType1 = bills[1].get('bill type')[0];
  let contributor = bills[0].get('contributor')[0];
  bills[0].set('bill type', billType1);
  bills[1].set('bill type', billType0);
  console.log('-----------');
  console.log(bills[0].get('bill type')[0].get('Name'));
  console.log(bills[1].get('bill type')[0].get('Name'));
}

test().then();
