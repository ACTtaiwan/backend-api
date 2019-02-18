import { TagManager } from '../../libs/dataManager/TagManager';

let test = async () => {
  let tagMngr = new TagManager();

  // await tagMngr.addTagToBill('ait', 'afae2b67-87a4-44d9-9b87-62b31fcd41c4',
  //   {
  //     'userA': 777
  //   },
  //   {
  //     id: '548ae7d6-4659-4326-82e8-0831d4dd9d61', // <string> uuid(),
  //     typeCode: 'person',
  //     typeDisplay: 'Person'
  //   })
  // await tagMngr.userActOnTagToBill('ait', 'afae2b67-87a4-44d9-9b87-62b31fcd41c4', 'userA', 123)

  // await tagMngr.addTagToBill('ait', 'a4bb4513-a1b0-4c5b-bcea-975abfc02e9e', null, {
  //   id: '548ae7d6-4659-4326-82e8-0831d4dd9d61',
  //   typeCode: 'person',
  //   typeDisplay: 'Person'
  // })

  // await tagMngr.userActOnTagToBill('taiwan', 'a4bb4513-a1b0-4c5b-bcea-975abfc02e9e', 'xxx', 'up')
  // await tagMngr.userActOnTagToBill('us', 'a4bb4513-a1b0-4c5b-bcea-975abfc02e9e', 'xxx', 111)

  // await tagMngr.userActOnTagToBill('new', 'a4bb4513-a1b0-4c5b-bcea-975abfc02e9e', 'xxx', 'up')
  // await tagMngr.userActOnTagToBill('new', 'a4bb4513-a1b0-4c5b-bcea-975abfc02e9e', 'xxx', 'up')
  // await tagMngr.userActOnTagToBill('new', 'a4bb4513-a1b0-4c5b-bcea-975abfc02e9e', 'yyy', 'down')
  // await tagMngr.userActOnTagToBill('new', 'a4bb4513-a1b0-4c5b-bcea-975abfc02e9e', 'xxx', 'down')

  // let tags = await tagMngr.getTag('ait')
  // console.log(JSON.stringify(tags, null, 2))

  // let tags2 = await tagMngr.getTagsOfBill('aaa')
  // console.log(JSON.stringify(tags2, null, 2))

  // let tags = await tagMngr.searchTagStartWith('a')
  // console.log(JSON.stringify(tags, null, 2))

  // await tagMngr.removeTagFromBill('ait', 'afae2b67-87a4-44d9-9b87-62b31fcd41c4')
  // await tagMngr.removeTagFromBill('ait', 'a4bb4513-a1b0-4c5b-bcea-975abfc02e9e')
  // await tagMngr.removeTagFromBill('new', 'a4bb4513-a1b0-4c5b-bcea-975abfc02e9e')
  // await tagMngr.removeTagFromBill('us', 'a4bb4513-a1b0-4c5b-bcea-975abfc02e9e')
  // await tagMngr.removeTagFromBill('taiwan', 'a4bb4513-a1b0-4c5b-bcea-975abfc02e9e')

  // let tags = await tagMngr.searchTagContains('new')
  // console.log(JSON.stringify(tags, null, 2))

  // await tagMngr.tblTag.deleteTag('new')
  await tagMngr.deleteAllTags();
};

test();