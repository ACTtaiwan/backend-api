import * as dbLib from '../../libs/dbLib';
import * as _ from 'lodash';

var awsConfig = require('../../config/aws.json');

let doBatch = async (roles: dbLib.RoleEntity[], tbl: dbLib.RoleTable): Promise<boolean | void> => {
  console.log(`Role batch size = ${roles.length}`);
  let deferred: Array<() => Promise<any>> = [];
  for (let i = 0; i < roles.length; ++i) {
    let role = roles[i];
    if (role.person) {
      let updateRole = <dbLib.RoleEntity> {
        personId: role.person.id
      };
      deferred.push(() =>
        tbl.updateRole(role.id, updateRole).then(() =>
        tbl.deleteAttributesFromRole(role.id, 'person')));
    }
  }
  console.log(`Updating promises = ${deferred.length}`);
  let batchSize = 200;
  while (deferred.length > 0) {
    let batchDeffered = deferred.splice(0, batchSize);
    let batchPromises = _.map(batchDeffered, f => f());
    await Promise.all(batchPromises);
    console.log(`remaining ${deferred.length}`);
  }
  console.log('\n');
};

let migrate = async () => {
  let tblName = (<any> awsConfig).dynamodb.VOLUNTEER_ROLES_TABLE_NAME;
  let tbl = dbLib.DynamoDBManager.instance().getTable<dbLib.RoleTable>(tblName);
  tbl.forEachBatchOfAllRoles(async (roles) => {
    await doBatch(roles, tbl);
  });
};

migrate();
