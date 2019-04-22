import { SendPulseAgent } from '../../libs/subscribe/SendPulseAgent';
import { MailigenAgent } from '../../libs/subscribe/MailigenAgent';

// SendGridAgent

// let subscribe = async () => {
//   let sg = await SendGridAgent.instance
//   let res = await sg.subscribe('')
//   console.log(`Result = ${JSON.stringify(res, null, 2)}`)
// }

// subscribe()

// SendPulse

// let subscribe = async () => {
//   let sg = await SendPulseAgent.instance;
//   let res = await sg.subscribe('yingpo.liao@gmail.com', 'Mushroom', 'Any', 'act');
//   console.log(`Result = ${JSON.stringify(res, null, 2)}`);
// };

// subscribe();

// Mailigen

let subscribe = async () => {
  let sg = await MailigenAgent.instance;
  let res = await sg.subscribe('yingpo.liao@gmail.com', 'Mushroom', undefined, 'ustw');
  console.log(`Result = ${JSON.stringify(res, null, 2)}`);
};

subscribe();
