import { PropublicaAPI, PropublicaAPIMembers } from '../../libs/propublica/PropublicaAPI';
import * as types from '../../libs/propublica/PropublicaModels';
import * as dbLib2 from '../../libs/dbLib2';
import * as _ from 'lodash';
import Utilty from '../../libs/utils/Utility';

// namespace alias
import MembersAPITypes = types.PropublicaAPI.MembersAPI;

export class CongressMembersSync {
  private logger = new dbLib2.Logger('CongressMembersSync');
  private api: PropublicaAPIMembers;
  private g: dbLib2.IDataGraph;
  private mockWrite: boolean = false;

  public async init () {
    this.api = (await PropublicaAPI.instance).membersAPI;
    this.g = await dbLib2.DataGraph.getDefault();
  }

  public setMockWrite (flag: boolean) {
    this.mockWrite = flag;
  }

  public async syncAllMembersFromPropublica (congress: number) {
    let fLog = this.logger.in('syncAllMembersFromPropublica');
    if (congress < PropublicaAPIMembers.MIN_CONGRESS_SUPPORT) {
      throw new Error(`congress ${congress} < ${PropublicaAPIMembers.MIN_CONGRESS_SUPPORT} (min. support congress of PropublicaAPI)`);
    }

    let senMembers = await this.api.getMemberList(congress, 'senate');
    let repMembers = await this.api.getMemberList(congress, 'house');

    let batchInsert: dbLib2.IEntPerson[] = [];
    let batchUpdate: dbLib2.IEntPerson[] = [];

    let syncedMemIdx = new Set<string>();

    let sync = async (m: MembersAPITypes.GetMemberListAPI.Member) => {
      fLog.log(`Sync member ${m.id}`);

      if (syncedMemIdx.has(m.id)) {
        fLog.log(`Skip duplicate & already synced`);
        return;
      }

      try {
        fLog.log(`Creating roles from ProPublica API`);
        let role = await this.createRoleFromPropublica(congress, m.id);

        fLog.log(`Sync roles to DB`);
        await this.syncMemberFromPropublica(m, role, batchInsert, batchUpdate);

        syncedMemIdx.add(m.id);
        fLog.log(`Done member ${m.id}. \n\n`);
      } catch (e) {
        fLog.log(`Error = ${JSON.stringify(e)}`);
      }
    };

    fLog.log(`-------------- Sync Senates --------------`);
    for (let i = 0; i < senMembers.length; ++i) {
      await sync(senMembers[i]);
    }

    fLog.log(`-------------- Sync Reps --------------`);
    for (let i = 0; i < repMembers.length; ++i) {
      await sync(repMembers[i]);
    }

    fLog.log(`-------------- Batch Inserting (${batchInsert.length} items) --------------`);
    !this.mockWrite && await this.g.insertEntities(batchInsert);

    fLog.log(`-------------- Batch Updating (${batchUpdate.length} items) --------------`);
    !this.mockWrite && await this.g.updateEntities(batchUpdate);
  }

  public async syncMemberFromPropublica (
    member: MembersAPITypes.GetMemberListAPI.Member,
    role:  dbLib2.IEntPersonRole,
    batchInsert?: dbLib2.IEntPerson[],
    batchUpdate?: dbLib2.IEntPerson[]
  ) {
    let fLog = this.logger.in('syncMemberFromPropublica');
    fLog.log(`Sync member ${member.id}`);

    let ents = await this.g.findEntities<dbLib2.IEntPerson>({
       _type: dbLib2.Type.Person,
       bioGuideId: member.id
    });

    if (ents.length > 1) {
      throw new Error(`match multiple BioGuideId (${member.id}). ENTs = ${JSON.stringify(ents, null, 2)}`);
    }

    // map propublica member to our member
    let mapGender = (g: string): dbLib2.IEntPerson['gender'] => {
      switch (g) {
        case 'M':
          return 'male';

        case 'F':
          return 'female';
      }
      return undefined;
    };

    let newMem: Partial<dbLib2.IEntPerson> = {
      _type: dbLib2.Type.Person,
      firstName: member.first_name,
      lastName: member.last_name,
      middleName: member.middle_name,
      nameSuffix: member.suffix,
      gender: mapGender(member.gender),
      birthday: member.date_of_birth,
      website: member.url,
      office: member.office,
      phone: member.phone,
      bioGuideId: member.id,
      cspanId: member.cspan_id,
      twitterId: member.twitter_account,
      facebookId: member.facebook_account,
      youtubeId: member.youtube_account
    };

    // create role
    newMem.congressRoles = [ role ];

    // filter out empty fields
    newMem = _.pickBy(newMem, v => !!v);

    if (ents.length === 0) {
      // insert
      fLog.log(`[Insert Member] ${JSON.stringify(newMem, null, 2)}`);
      batchInsert
        ? batchInsert.push(newMem as dbLib2.IEntPerson)
        : (!this.mockWrite && await this.g.insertEntities([newMem as dbLib2.IEntPerson]));
    } else {
      // update
      let currentMem = ents[0];

      let diff = _.pickBy(newMem, (v, k) => (k !== 'congressRoles') && !!v && (v !== currentMem[k]));
      let mergedRoles = this.mergeRoles(currentMem.congressRoles, newMem.congressRoles[0]);
      if (!!mergedRoles && mergedRoles.length > 0) {
        diff.congressRoles = mergedRoles;
      }

      if (!_.isEmpty(diff) || !!diff.congressRoles) {
        diff._type = currentMem._type;
        diff._id = currentMem._id;
        fLog.log(`[Update Member] ${JSON.stringify(diff, null, 2)}`);
        batchUpdate
          ? batchUpdate.push(diff as dbLib2.IEntPerson)
          : (!this.mockWrite && await this.g.updateEntities([diff as dbLib2.IEntPerson]));
      }
    }
  }

  public async createRoleFromPropublica (congress: number, bioGuideId: string): Promise<dbLib2.IEntPersonRole> {
    let member = await this.api.getMember(bioGuideId);
    let role = member.roles.find(r => parseInt(r.congress) === congress);

    // map propublica chamber
    let mapChamber = (c: string): dbLib2.Chamber => {
      switch (c) {
        case 'House':
          return 'h';

        case 'Senate':
          return 's';
      }
      throw new Error(`Can not map chamber: ${c}`);
    };

    // map propublica party
    let mapParty = (c: string): dbLib2.IEntPersonRoleParty => {
      switch (c) {
        case 'D':
          return 'Democrat';

        case 'R':
          return 'Republican';

        case 'I':
        case 'ID':
          return 'Independent';
      }
      throw new Error(`Can not map party: ${c}`);
    };

    // map YYYY-MM-DD
    let newRole = <dbLib2.IEntPersonRole> {
      congressNumbers: [congress],
      chamber: mapChamber(role.chamber),
      party: mapParty(role.party),
      state: role.state,
    };

    let startDate = Utilty.parseDateTimeStringAtEST(role.start_date, 'YYYY-MM-DD');
    if (!!startDate) {
      newRole.startDate = startDate.getTime();
    } else {
      throw new Error(`Can not parse start date: ${role.start_date}`);
    }

    let endDate = Utilty.parseDateTimeStringAtEST(role.end_date, 'YYYY-MM-DD');
    if (!!endDate) {
      newRole.endDate = endDate.getTime();
    } else {
      throw new Error(`Can not parse end date: ${role.end_date}`);
    }

    if (!!role.district) {
      newRole.district = parseInt(role.district);
    }

    if (!!role.senate_class) {
      newRole.senatorClass = parseInt(role.senate_class);
    }

    return newRole;
  }

  private mergeRoles (currentRoles: dbLib2.IEntPersonRole[], newRole: dbLib2.IEntPersonRole): dbLib2.IEntPersonRole[] {
    let fLog = this.logger.in('mergeRoles');
    if (newRole.congressNumbers.length !== 1) {
      throw new Error (`congressNumbers.length = ${newRole.congressNumbers.length} must be 1`);
    }

    // find roles by instersection of congress number
    let congress = newRole.congressNumbers[0];
    let existRoles = currentRoles.filter(r => _.includes(r.congressNumbers, congress));

    if (existRoles.length === 0) {
      // congress not exist -> push front
      fLog.log('Congress not exist -> push front');
      currentRoles.unshift(newRole);
      return currentRoles;
    } else if (existRoles.length > 1) {
      throw new Error(`Found ${existRoles.length} intersection roles. Don't know how to merge multiple intersections`);
    } else {
      let existRole = existRoles[0];
      let notOverlap = (newRole.startDate > existRole.endDate) || (newRole.endDate < existRole.startDate);
      if (notOverlap) {
        // time span not overlapped -> push front
        fLog.log('Time span not overlapped -> push front');
        currentRoles.unshift(newRole);
        return currentRoles;
      } else {
        // time span overlapped
        let pickKeys: (keyof dbLib2.IEntPersonRole)[] = ['chamber', 'party', 'state', 'district', 'senatorClass'];
        let o = _.pick(existRole, ...pickKeys);
        let n = _.pick(newRole, ...pickKeys);
        let changeProp = !_.isEqual(o, n);
        if (changeProp) {
          // property changed (party, state, chamber...) -> push front
          fLog.log('Time span overlapped & property changed -> push front');
          currentRoles.unshift(newRole);
          return currentRoles;
        } else {
          // property not changed --> merge time span of existing role
          let startDate = Math.min(existRole.startDate, newRole.startDate);
          let endDate = Math.max(existRole.endDate, newRole.endDate);
          let timeChanged = (startDate !== existRole.startDate) || (endDate !== existRole.endDate);
          if (timeChanged) {
            fLog.log(`Time span overlapped & property NOT changed & time span changed -> OLD = (${existRole.startDate}, ${existRole.endDate}), NEW = (${startDate}, ${endDate})`);
            existRole.startDate = startDate;
            existRole.endDate = endDate;
          } else {
            fLog.log(`Time span overlapped & property NOT changed & time span NOT changed -> no aciton needed`);
            return undefined;
          }
        }
      }
    }
  }
}

if (require.main === module) {
  const o = new CongressMembersSync();
  // o.setMockWrite(true);
  o.init().then(() => o.syncAllMembersFromPropublica(116));
  // o.init().then(async () => {
  //   let role = await o.createRoleFromPropublica(116, 'A000360');
  //   console.log(JSON.stringify(role, null, 2));
  // });
}
