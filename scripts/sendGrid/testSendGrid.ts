import { SendGridAgent } from '../../libs/sendGrid/SendGridAgent';

let subscribe = async () => {
  let sg = await SendGridAgent.instance
  let res = await sg.subscribe('')
  console.log(`Result = ${JSON.stringify(res, null, 2)}`)
}

subscribe()
