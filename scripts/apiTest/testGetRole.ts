import * as api from '../../functions/private/billManagement/roleHandler';

let test = async () => {
  // // single id
  // let out = await api.RoleHandler.dispatchEvent('GET', {id: 'b42ebca7-665d-402a-9db2-457bb6de07ab'})

  // // multiple idx
  // let out = await api.RoleHandler.dispatchEvent('GET', {id: 'b42ebca7-665d-402a-9db2-457bb6de07ab,299a3259-29a1-45f4-a0b6-b25e5c8ed6f4'})

  // // 1 congress
  // let out = await api.RoleHandler.dispatchEvent('GET', {congress: '115'})

  // // N congress
  // let out = await api.RoleHandler.dispatchEvent('GET', {congress: '115,114'})

  // // 1 state
  // let out = await api.RoleHandler.dispatchEvent('GET', {states: 'WA'})

  // // N states
  // let out = await api.RoleHandler.dispatchEvent('GET', {states: 'WA,TX'})

  // // 1 state + 1 congress
  // let out = await api.RoleHandler.dispatchEvent('GET', {states: 'WA', congress: '115'})

  // // 2 state + 1 congress
  // let out = await api.RoleHandler.dispatchEvent('GET', {states: 'WA,TX', congress: '115'})

  // // 1 state + 2 congress
  // let out = await api.RoleHandler.dispatchEvent('GET', {states: 'WA', congress: '115,114'})

  // // 1 personId
  // let out = await api.RoleHandler.dispatchEvent('GET', {personId: '2cc2d8d2-7c2d-49bc-b8af-f11b04b7cfa9'})

  // N personId
  let out = await api.RoleHandler.dispatchEvent('GET',
    {personId: '2cc2d8d2-7c2d-49bc-b8af-f11b04b7cfa9,be4b569c-148e-4f09-a9f3-18e413d7e577'})
  console.log(JSON.stringify(out.length, null, 2))
}
test()
