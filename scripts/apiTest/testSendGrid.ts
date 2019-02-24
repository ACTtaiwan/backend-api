import * as api from '../../functions/private/sendGrid/sendGridApiHandler';

let test = async () => {
  // subscribe
  let out = await api.SendGridApiHandler.dispatchEvent('POST', {body: {email: ''}});

  console.log(JSON.stringify(out, null, 2));
};
test();
