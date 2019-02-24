import { RoleManager } from '../../libs/dataManager/RoleManager';

let roleMngr = new RoleManager();

// let rebuildCongressIndex = async () => {
//   await roleMngr.rebuildCongressIndex()
// }
// rebuildCongressIndex()

// let getRolesByBioGuideId = async () => {
//   let roles = await roleMngr.getRolesByBioGuideId('N000147')
//   console.log(JSON.stringify(roles, null, 2))
// }
// getRolesByBioGuideId()

let getRoleByStatesAndCongress = async () => {
  let roles = await roleMngr.getRoleByStatesAndCongress('WA', 115);
  console.log(JSON.stringify(roles, null, 2));
};
getRoleByStatesAndCongress();