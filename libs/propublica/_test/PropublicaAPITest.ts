import { PropublicaAPI, PropublicaAPIMembers } from '../PropublicaAPI';
import { expect } from 'chai';

describe('PropublicaAPITest', () => {
  let propublica: PropublicaAPI;

  before(async () => {
    propublica = await PropublicaAPI.instance;
  });

  describe('PropublicaAPITest', () => {
    let api: PropublicaAPIMembers;

    before(() => {
      api = propublica.membersAPI;
    });

    it('getMemberList() should list member', async () => {
      const json = await api.getMemberList(115, 'senate');
      expect(json);
      expect(json).lengthOf(105);
      expect(json[0].api_uri).equal('https://api.propublica.org/congress/v1/members/A000360.json');
    });

    it('getMember() should get a specific member', async () => {
      const json = await api.getMember('S001202');
      expect(json);
      expect(json.first_name).equal('Luther');
      expect(json.last_name).equal('Strange');
      expect(json.member_id).equal('S001202');
    });

    it('getMemberListByStateAndDistrict() should get members by state / district - SENATE', async () => {
      const json = await api.getMemberListByStateAndDistrict('senate', 'WA');
      expect(json);
      expect(json).lengthOf(2);
      expect(json[0].id).equal('C000127');
    });

    it('getMemberListByStateAndDistrict() should get members by state / district - HOUSE', async () => {
      const json = await api.getMemberListByStateAndDistrict('house', 'WA', 1);
      expect(json);
      expect(json).lengthOf(1);
      expect(json[0].district).equal('1');
      expect(json[0].at_large).equal(false);
    });
  });
});
