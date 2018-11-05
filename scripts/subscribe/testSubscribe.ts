import { SendGridAgent } from '../../libs/subscribe/SendGridAgent'
import { SendPulseAgent } from '../../libs/subscribe/SendPulseAgent'

// SendGridAgent

// let subscribe = async () => {
//   let sg = await SendGridAgent.instance
//   let res = await sg.subscribe('')
//   console.log(`Result = ${JSON.stringify(res, null, 2)}`)
// }

// subscribe()

let subscribe = async () => {
  let sg = await SendPulseAgent.instance
  let res = await sg.subscribe('yingpo.liao@gmail.com', 'Mushroom', 'Any', 'act')
  console.log(`Result = ${JSON.stringify(res, null, 2)}`)
}

subscribe()
