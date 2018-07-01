import * as mongoDbLib from '../../../libs/mongodbLib'
import { MongoDbConfig } from '../../../config/mongodb'
import * as _ from 'lodash'

const tblName = MongoDbConfig.tableNames.BILLCATEGORIES_TABLE_NAME

class TestBillCategoryTable {
  public static async getAllCategories () {
    let tbl = await TestBillCategoryTable.getTable()
    let allCats = await tbl.getAllCategories()
    console.log(JSON.stringify(allCats, null, 2))
  }

  public static async getCategoriesById () {
    let tbl = await TestBillCategoryTable.getTable()
    let allCats = await tbl.getCategoriesById(['6ca1b2d8-9c15-471d-b680-8a5a3712b052', 'ea86372b-69e5-4102-a087-2e61b73a129a'], 'code', 'name_zh')
    console.log(JSON.stringify(allCats, null, 2))
  }

  public static async setBillIdArrayToCategory () {
    const catId = '6ca1b2d8-9c15-471d-b680-8a5a3712b052'
    let tbl = await TestBillCategoryTable.getTable()
    await tbl.setBillIdArrayToCategory(catId,  [
      '037faf19-f05b-4c73-bc1b-efb0009bd73e',
      '038964e6-b0d4-43a0-9c16-03207117e2ac',
      '09646b1e-31c6-4ce1-861a-25e168951dad',
      '0b4be131-fdac-4732-9fbd-18dc9d18fd46',
      '0cdea475-e2cd-475e-8b45-fc1f4278b1cf',
      '0fb87e14-b30f-4ad4-9f80-4a3d6e7ec5b9',
      '12bd743c-83f4-4e7c-9558-c54081a3ca01',
      '148061d2-bee5-4fcc-9767-1082214585c3',
      '14d22972-1ab5-458a-a832-aa74a1e78852',
      '15a2ed64-13a6-4b2a-8c8f-2ecd6b99e28e',
      '16963245-28d1-49a0-8bfb-4512c9fcef3a',
      '16d24ff8-f522-4ef5-ace1-3b2ceb2a678e',
      '1785f6c4-6119-489a-9096-be12c6f1ca3d',
      '18511d5a-a8ef-4f8a-9acf-251037b29a1f',
      '1ff0ebe0-775b-4373-88cb-94c8bc966677',
      '20b9bf33-720b-4164-8dd3-467b733212d7',
      '212afeb6-4fa9-4bc1-b177-02599b4d6a5f',
      '24622795-040e-4ab2-9f4a-a35d4ddac8ef',
      '272dfdfa-ccb6-4c37-aebb-047fd5fac016',
      '2740b54a-d185-48f0-b0a4-41ab7f381f77',
      '27ec632c-c263-42b9-ab19-4fca146eebcc',
      '28023e24-ec9e-4874-88b6-755f6e1fcbfd',
      '293282ad-e365-4a7a-b444-9fdb9799de18',
      '2b74ec52-6a50-448e-aa2f-43f123ede125',
      '2cf91061-34cf-4839-a12b-69113141a64a',
      '2cfe2996-9bc0-465b-8f19-5fcc5f9dbeb2',
      '337c8fc9-6ead-4ab2-92ed-223050c7a231',
      '33e887b3-4898-47cc-bec2-b7e59a1b7c6e',
      '344eda61-4f81-4d89-8b26-7dfcff3e093d',
      '3474a6a3-cb05-4a73-94be-82da7ec15a7d',
      '359fd049-3090-4eeb-a0d8-21d192dd4269',
      '3651b79f-7026-4a3b-b02f-541d886bfa41',
      '36c97189-6cde-4f09-980e-5255cf68c3a2',
      '385d281c-1c54-4f51-b91e-edb4195d12c9',
      '388e9c8a-f997-43d0-bef2-3f9595412f49',
      '38b4a7bf-6ea7-4bee-a17c-667a6cfc355c',
      '39b6e1c9-395b-4635-84c2-12eb63433c4e',
      '3be1edb7-ff50-4091-af3c-a46060de811a',
      '3c1e5fa7-2e33-4907-a410-759b24671d41',
      '3db6e363-cabd-4802-8955-63e786b6fc30',
      '3e94f735-d5f1-4300-aba3-196513331052',
      '3f1009d6-0ad1-42bc-a0c1-92867dc2cb27',
      '3fa9e56a-6650-4abb-8190-1ba092d1db15',
      '41a8533c-2bd2-4ab9-ab35-d8fe5a5830b5',
      '421cc454-47fc-427f-8ec5-36828e565612',
      '432f373e-5968-467b-89f1-02bd62ed28c1',
      '45ae9e0f-30b1-4970-a700-460480330e23',
      '4602b7f8-cfa1-41cf-b0c9-aff3a6a34f75',
      '47333621-0024-455b-af67-487385d37980',
      '49335738-b6c4-4357-95dd-76c4dda3d86c',
      '4ae88a88-96f4-4b9e-bc6a-d741016648a1',
      '4bb8da42-425a-4a4a-8390-a97bfdf921e3',
      '4bc846a1-b41e-478e-892e-a44133daa379',
      '4bf16bcc-ccc5-4749-ab5b-b181db2b771a',
      '514e2d0e-4634-4c50-ab5c-e9be485cd275',
      '5570b1a4-5cb4-44b5-a7c8-dc00183e0651',
      '56cda8e2-7735-473f-b779-3d9673f9e9f0',
      '56d56f36-f848-47d7-8819-2312e1f994eb',
      '57109567-b382-4b38-a76b-1a5171c4e4f4',
      '588ea205-fbdf-4876-8d40-cf3e494d933e',
      '58b6243c-b31a-4dd2-88e3-01e906adbf62',
      '59941faf-d7a0-45eb-b90b-93fb6c7e3fa1',
      '5a9e74a7-db74-415d-a933-76b07ec5aaad',
      '5b0dfb52-af98-449b-936d-3bc6f17da788',
      '5bd1c02a-fa4e-4053-907c-ce4f2e9549c5',
      '5c02c0e4-01e1-4c85-8c2b-c7c3bf09323f',
      '5ce88342-74da-4e24-9a57-c4f096b8225d',
      '5f97aaf8-d256-48da-9cd7-50c2450240a4',
      '623e0529-e4bd-4bd4-8b2c-fc34f2997d2a',
      '63a94ad3-fe70-43f1-95b9-0286ec1127bb',
      '63f2e905-96e0-45ed-a0bd-e18e712c8808',
      '641ab75a-8f65-44df-91ec-e91cff2ddce5',
      '676c432b-bf2f-4a5f-8f06-263322bd93ee',
      '695f4760-cfd7-45e2-9095-2018c2b96aba',
      '6a2b4960-84c3-4308-8b5f-1c25ff4fe390',
      '6b0da3aa-9058-4f9d-8dbb-46a1cf5f467d',
      '6bfbefdb-ed22-42db-b8a7-ad11cf03b985',
      '6f753f1b-e121-4f69-8bf4-a438d4844f2c',
      '70ff97c5-de57-410b-83c8-30be19b650df',
      '71832b84-6575-42fb-b92f-993861b17360',
      '722885a2-154c-4c55-aeab-0d6f9e053aa2',
      '7744f5bc-4744-4c90-8df3-2d0b14108656',
      '77ed5d8a-440d-45eb-adfe-e02d24167bb3',
      '79cbef80-3610-434a-93fc-74879741aa84',
      '7b749fd4-3c36-42c8-904f-b8f93a85d7d7',
      '7f082d62-ff16-4f3b-9925-17c5a512bba2',
      '84c0dcac-7a21-4f11-9dff-b0514fd6339c',
      '891576ff-2136-4e08-afe3-b79a9a67e344',
      '8aa68d48-540a-4103-ba89-cad7b3fe5c42',
      '8b0df3df-bd87-4d0b-81ca-7b0546d7055f',
      '8bab0705-6011-4a29-8518-86e76b97a5ef',
      '8dc5941c-ccf0-42d8-923f-4df334702a5c',
      '8dd53af3-97a0-442a-9365-7bdd36bfe32d',
      '90d81b70-58c4-4aa7-a4ff-a7d7a825c5f5',
      '95482f28-c2f2-4f2a-b2e1-36386ac253e3',
      '98354120-785f-4d34-b448-aee49d4f94e3',
      '98f447d3-5f54-4034-8aac-4c58d28a16e4',
      '99d14170-d3f6-41ef-a947-03390ef18b01',
      '9a83a249-2f77-4c66-b140-8862cedbc91d',
      '9b8f47af-b8b1-48fc-9fa6-5a33bc50f6df',
      '9f39c0c1-f251-4b47-957a-198d01c21761',
      'a0fe85bb-761e-45cf-9137-8ec2777c8a97',
      'a1e1da36-bf5c-4fba-a87f-415e8575b610',
      'a3cdd9e8-bbf3-458f-95b6-510eca14dd13',
      'a3f1b9d6-2fda-46ae-b9bf-048766f204cc',
      'a9930244-4ca9-4bd3-a6a9-3f750a52586a',
      'ab982718-4cf8-45c2-9be4-cf2bc4a462cd',
      'aba097a8-b83a-4167-9802-ace9b1981c2c',
      'ae3d3863-2495-48d0-b0c4-1b41cc50d70b',
      'b0219155-827a-4ea9-bc56-8e29dbd7a894',
      'b22fd033-459f-4815-8804-36eba6c90465',
      'b2e9951e-2d99-4259-90f9-0644b199129b',
      'b33a858c-b485-48b2-b971-0c559fb51c1a',
      'b3bc4db2-f7d6-495c-bc55-575d973d65ff',
      'b47eb3eb-fab2-408b-9abc-444b9077007c',
      'b5248802-07ce-40a6-b246-4182b612e21a',
      'b74390c1-1200-401c-9552-3c2913b94fef',
      'b8b81f40-76be-4556-a66c-c51e2b581c9c',
      'b8f2d388-6e0b-4d7f-9cdf-3c31be1ba1d2',
      'b9155fd3-b652-4770-89f1-eeb49492a4d6',
      'bbf5e6a6-2ae7-4f2b-ba84-e715be459711',
      'bc829584-fe34-4074-8642-dcfe77eb157a',
      'bf7c7170-01a2-40cf-9322-c7a138e2d48e',
      'c077def0-6df7-44cd-a214-2d52c4208b33',
      'c0b2f416-509d-41b6-b504-278b0d8bac49',
      'c2dbd519-81af-4c4b-808c-14c655cdb58a',
      'c37780da-6049-4339-83a4-09eb6f64c031',
      'c4b90b92-3297-47a5-a376-1e41e10e467a',
      'c570360b-c523-4e90-99e3-38806a0dee33',
      'c7e99a0b-312c-4404-bef3-50c744f2681b',
      'c80f0afd-7587-4c39-80bc-0dfb56f037db',
      'c866f93c-862c-43ed-bcd9-a8b47cdb6260',
      'c94d5420-ac92-4174-b68d-e65c9bd981e5',
      'c982ad51-2b4c-414e-a020-0a19abd2bbc7',
      'c9ebc358-10cf-4563-a34b-9dc49bcf9d77',
      'cae10a31-ea66-4bbb-a349-b68ec5eb074c',
      'cc24e009-b906-4db9-ac13-b595b7b28a23',
      'd154a79f-2d23-40d9-a70b-b4dd2a89ef1a',
      'd2647a41-ca87-452c-baf0-26cd97ab9452',
      'd43548e5-b6cf-4e16-9cb7-0b19cdb02ee7',
      'd78f57bd-ed26-4d94-b7ac-0ad8ae496cb2',
      'dc48f5ca-2622-4d1e-af31-51015aae7eb5',
      'df717157-4d7b-4a55-acf4-eae451f2ff64',
      'e26c1896-007a-4663-af48-fac69304d717',
      'e442d044-ae38-42bf-9243-e0c8db6cfa6e',
      'e63fe913-3e6b-493a-9ddf-23bac9e41af6',
      'e66b5488-b0a0-433a-b05d-7147702f1f5f',
      'e81e44e0-edac-48c5-bb09-10dc4de3595a',
      'e842c1c8-6599-42da-b420-37957a5ae08c',
      'e85329e3-94c1-4104-aa2f-1e9182d0f11a',
      'e8fd3200-0dad-41fe-a8d9-52a37640b401',
      'e9a74080-7be6-43ef-a13e-71d2b4ef2219',
      'eab7da0a-6ef4-4505-929e-3cb7dda752b5',
      'eb6b7d26-63a1-445c-af7c-41faafcd55e2',
      'ece98a45-fbaf-4c65-85eb-0d78d659ea7c',
      'f3aecdce-9bc4-4079-98c1-abec9aff6681',
      'f42c41fa-f184-49e8-ab24-a5f292f64784',
      'f5f62fec-3f1d-4e58-8330-6f726859ecf5',
      'f66eb0f0-c656-4ad4-9515-d820763f542d',
      'f8514d06-f97c-471b-a9f1-cd2221060606',
      'f9d37ab0-6796-4db4-917d-1a346256fea5',
      'fea05e2b-6f8f-4847-be59-032e970a9b2b',
      'ff49c12b-facd-4655-943d-a88b54f86fde'
    ])
    let allCats = await tbl.getCategoriesById([catId])
    console.log(JSON.stringify(allCats, null, 2))
  }

  public static async addBillToCategory () {
    const catId = '6ca1b2d8-9c15-471d-b680-8a5a3712b052'
    let tbl = await TestBillCategoryTable.getTable()
    await tbl.addBillToCategory(catId, 'abcde')
    await tbl.addBillToCategory(catId, 'de')
    let allCats = await tbl.getCategoriesById([catId])
    console.log(JSON.stringify(allCats, null, 2))
  }

  public static async removeBillFromCategory () {
    const catId = '6ca1b2d8-9c15-471d-b680-8a5a3712b052'
    let tbl = await TestBillCategoryTable.getTable()
    await tbl.removeBillFromCategory(catId, 'abcde')
    await tbl.removeBillFromCategory(catId, 'de')
    let allCats = await tbl.getCategoriesById([catId])
    console.log(JSON.stringify(allCats, null, 2))
  }

  public static async removeAllBillsFromCategory () {
    const catId = '6ca1b2d8-9c15-471d-b680-8a5a3712b052'
    let tbl = await TestBillCategoryTable.getTable()
    await tbl.removeAllBillsFromCategory(catId)
    let allCats = await tbl.getCategoriesById([catId])
    console.log(JSON.stringify(allCats, null, 2))
  }

  private static async getTable () {
    const db = await mongoDbLib.MongoDBManager.instance
    const tblCat = db.getTable<mongoDbLib.BillCategoryTable>(tblName)
    return tblCat
  }
}

TestBillCategoryTable.getAllCategories()
// TestBillCategoryTable.getCategoriesById()
// TestBillCategoryTable.setBillIdArrayToCategory()
// TestBillCategoryTable.addBillToCategory()
// TestBillCategoryTable.removeBillFromCategory()
// TestBillCategoryTable.removeAllBillsFromCategory()