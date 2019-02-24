import * as api from '../../functions/private/billManagement/tagHandler';

let test = async () => {
  let out = await api.TagHandler.dispatchEvent('GET', {q: encodeURIComponent('one china')});
  console.log(JSON.stringify(out, null, 2));
};

test();