// import * as assert from 'assert';
// import { Person } from './Person';
// // import { Bill } from './Bill';

// const TEST_DATA_MEMBER1 = {
//   lastname: 'lastname_1',
//   firstname: 'firstname_1',
//   bioGuideId: 'bioGuidId_1',
//   roles: [
//     {
//       congresses: [112, 113, 114],
//       type: 'senator',
//       state: 'ZZ',
//       class: 3,
//       party: 'Republican',
//       startDate: 1294185600000,
//       endDate: 1483401600000,
//     },
//     {
//       congresses: [115, 116, 117],
//       type: 'senator',
//       state: 'ZZ',
//       class: 3,
//       party: 'Republican',
//       startDate: 1483401600000,
//       endDate: 1672704000000,
//     },
//   ],
// }

// const TEST_DATA_MEMBER2 = {
//   lastname: 'lastname_2',
//   firstname: 'firstname_2',
//   bioGuideId: 'bioGuidId_2',
//   roles: [
//     {
//       congresses: [109],
//       type: 'representative',
//       state: 'ZX',
//       district: 13,
//       party: 'Democrat',
//       startDate: 1104796800000,
//       endDate: 1167782400000,
//     },
//     {
//       congresses: [110, 111, 112],
//       type: 'senator',
//       state: 'ZX',
//       class: 1,
//       party: 'Democrat',
//       startDate: 1167868800000,
//       endDate: 1357171200000,
//     },
//     {
//       congresses: [113, 114, 115],
//       type: 'senator',
//       state: 'ZX',
//       class: 1,
//       party: 'Democrat',
//       startDate: 1357171200000,
//       endDate: 1546473600000,
//     },
//   ],
// }

// const TEST_DATA_MEMBER3 = {
//   lastname: 'lastname_3',
//   firstname: 'firstname_3',
//   bioGuideId: 'bioGuidId_3',
//   roles: [
//     {
//       congresses: [108],
//       type: 'representative',
//       state: 'XX',
//       district: 0,
//       party: 'Democrat',
//       startDate: 1041897600000,
//       endDate: 1104710400000,
//     },
//     {
//       congresses: [109],
//       type: 'representative',
//       state: 'XY',
//       district: -1,
//       party: 'Republican',
//       startDate: 1104796800000,
//       endDate: 1167782400000,
//     },
//   ],
// }

// const TEST_DATA_TAG1 = {
//   tag: 'tag1',
// };

// const TEST_DATA_TAG2 = {
//   tag: 'tag 2',
// };

// const TEST_DATA_TAG3 = {
//   tag: 'tag_3',
// };

// const TEST_DATA_BILL1 = {
//   congress: 115,
//   billType: 's',
//   billNumber: 1051,
//   introducedDate: 1493856000000,
//   title: 'bill title 1',
//   // sponsored by member1
//   // has tag1, tag2
// };

// const TEST_DATA_BILL2 = {
//   congress: 109,
//   billType: 'hconres',
//   billNumber: 23,
//   introducedDate: 1114796800000,
//   title: 'bill title 2',
//   // sponsored by member2
//   // has tag1, tag3
// };

// const TEST_DATA_COSPONSOR_ASSOC_2_1 = {
//   // member 2 cosponsor bill 1
//   date: 1493874000000,
// };

// const TEST_DATA_COSPONSOR_ASSOC_3_2 = {
//   // member 3 cosponsor bill 2
//   date: 1124796800000,
// };

// const TEST_DATA_COSPONSOR_ASSOC_3_2a = {
//   date: 1124796801000,
// };


// (async function main () {
//   console.log('dbLib2 test start');

//   console.log('creating test data');
//   let member1 = new Person(TEST_DATA_MEMBER1);
//   member1.save();
//   let member1a = Person.load
//   // let member2 = new CongressMember(TEST_DATA_MEMBER2);
//   // let member3 = new CongressMember(TEST_DATA_MEMBER3);
//   // let bill1 = new Bill(TEST_DATA_BILL1);
//   // let bill2 = new Bill(TEST_DATA_BILL2);
//   // let tag1 = new Tag(TEST_DATA_TAG1);
//   // let tag2 = new Tag(TEST_DATA_TAG2);
//   // let tag3 = new Tag(TEST_DATA_TAG3);
//   // member1.sponsor(bill1);
//   // member2.sponsor(bill2);
//   // member2.cosponsor(bill1, TEST_DATA_COSPONSOR_ASSOC_2_1);
//   // member3.cosponsor(bill2, TEST_DATA_COSPONSOR_ASSOC_3_2);
//   // bill1.addTag(TEST_DATA_TAG1);
//   // bill1.addTag(TEST_DATA_TAG2);
//   // bill2.addTag(TEST_DATA_TAG1);
//   // bill2.addTag(TEST_DATA_TAG3);

//   // let bills = Bill.find(
//   //   [109, 115],
//   //   [member1.id, member2.id],
//   //   [member1.id, member2.id, member3.id],
//   //   [tag1.id, tag2.id, tag3.id],
//   // );
//   // assert.ok(
//   //   bills.length === 2 && bills[0].equals(bill1) && bills[1].equals(bill2),
//   //   'list bill test failed',
//   // );

//   // let members = CongressMember.find(
//   //   [bill1.id, bill2.id],
//   //   [109, 115],
//   //   ['XX', 'ZX', 'ZZ'],
//   //   [13, 0],
//   // );
//   // assert.ok(
//   //   members.length === 3 &&
//   //     members[0].equals(member3) &&
//   //     members[1].equals(member2) &&
//   //     members[2].equals(member1),
//   //   'list congress members test failed',
//   // );

//   // bill1.title = 'bill title 1 updated';
//   // bill1.save();
//   // let bill1a = Bill.load(bill1.id);
//   // assert.ok(bill1a.title === 'bill title 1 updated');

//   // -----------------------------------

//   // member3.cosponsor(bill2, TEST_DATA_COSPONSOR_ASSOC_3_2a);
//   // let bills = Bill.find(undefined, undefined, [member3.id], undefined);
//   // assert.ok(bills.length === 1, bills[0].equals(bill2));
//   // update cosponsor assoc data
//   // update tag assoc data

//   // delete tag assocs by (bill, tag)
//   // delete sponsor assocs by (bill, role)
//   // delete all cosponsor assocs for a bill
//   // delete a role
//   // delete all roles
//   // delete all tags
//   // delete all bills
//   // delete all people
// })();