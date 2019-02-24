import * as api from '../../functions/private/billManagement/billCategoryHandler';

let test = async () => {
  let apiObj = new api.BillCategoryApi();
  let out = await apiObj.fullFetchWithCongress(['88911008-392b-4934-b05e-516e3574f4bb'], [115]);
  console.log(`out = ${JSON.stringify(out, null, 2)}`);
};

test();