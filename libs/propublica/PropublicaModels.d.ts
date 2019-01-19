export declare namespace PropublicaAPI {
  export type ChamberType = 'house' | 'senate';

  export namespace MembersAPI {
    export namespace GetMemberListAPI {
      export interface Response {
        congress: number;
        chamber: 'Senate' | 'House';
        num_results: number;
        offset: number;
        members: Member[];
      }
  
      export interface Member {
        id: string;
        title: string;
        short_title: string;
        api_uri: string;
        first_name: string;
        middle_name: string;
        last_name: string;
        suffix: string;
        date_of_birth: string;
        gender: string;
        party: string;
        leadership_role: string;
        twitter_account: string;
        facebook_account: string;
        youtube_account: string;
        govtrack_id: string;
        cspan_id: string;
        votesmart_id: string;
        icpsr_id: string;
        crp_id: string;
        google_entity_id: string;
        fec_candidate_id: string;
        url: string;
        rss_url: string;
        contact_form: string;
        in_office: boolean;
        dw_nominate: number;
        ideal_point: number;
        seniority: string;
        next_election: string;
        total_votes: number;
        missed_votes: number;
        total_present: number;
        last_updated: string;
        ocd_id: string;
        office: string;
        phone: string;
        fax: string;
        state: string;
        district: string;
        at_large: boolean;
        geoid: string;
        missed_votes_pct: number;
        votes_with_party_pct: number;
      }
    }
  
    export namespace GetMemberAPI {
      export interface Member {
        member_id: string;
        first_name: string;
        middle_name: string;
        last_name: string;
        suffix: string;
        date_of_birth: string;
        gender: string;
        url: string;
        times_topics_url: string;
        times_tag: string;
        govtrack_id: string;
        cspan_id: string;
        votesmart_id: string;
        icpsr_id: string;
        twitter_account: string;
        facebook_account: string;
        youtube_account: string;
        crp_id: string;
        google_entity_id: string;
        rss_url: string;
        in_office: boolean;
        current_party: string;
        most_recent_vote: string;
        last_updated: string;
        roles: Role[];
      }
  
      export interface Role {
        congress: string; // "115"
        chamber: string; // "Senate"
        title: string; // "Senator, 2nd Class"
        short_title: string; // "Sen."
        state: string; // "AL"
        party: string; // "R"
        leadership_role: string; // ""
        fec_candidate_id: string; // "S8AL00308"
        seniority: string; // "1"
        state_rank: string; // "junior"
        lis_id: string; // "S392"
        ocd_id: string; // "ocd-division/country:us/state:al"
        start_date: string; // "2017-02-09"
        end_date: string; // "2018-01-02"
        office: string; // "326 Russell Senate Office Building"
        phone: string; // "202-224-4124"
        fax: string; // "202-224-3149"
        contact_form: string; // "https://www.strange.senate.gov/content/contact-senator"
        bills_sponsored: number; // 4
        bills_cosponsored: number; // 86
        missed_votes_pct: number; // 3.4
        votes_with_party_pct: number; // 96.88
        committees: Committee[];
        subcommittees: Subcommittee[];

        // only for house rep.
        district?: string; // "2"
        at_large?: boolean; // false

        // only f9or sen.
        senate_class: string; // "2"
      }
  
      export interface Committee {
        name: string; // "Committee on Agriculture, Nutrition, and Forestry"
        code: string; // "SSAF"
        api_uri: string; // "https://api.propublica.org/congress/v1/115/senate/committees/SSAF.json"
        side: string; // "majority"
        title: string; // "Member"
        rank_in_party: number; // 11
        begin_date: string; // "2018-01-02"
        end_date: string; // "2018-01-02"
      }

      export interface Subcommittee extends Committee {
        parent_committee_id: string; // "SSAF"
      }
    }

    export namespace GetMemberListByStateAndDistrict {
      export interface Member {
        id: string; // "M001197"
        name: string; // "Martha McSally
        first_name: string; // "Martha"
        middle_name: string; 
        last_name: string; // "McSally"
        suffix: string;
        role: string; // "Representative", "Senator, 1st Class"
        gender: string; // "F"
        party: string; // "R"
        times_topics_url: string; 
        twitter_id: string; // "RepMcSally"
        facebook_account: string;
        youtube_id: string;
        seniority: string; // "4"
        next_election: string; // "2018"
        api_uri: string; // "https://api.propublica.org/congress/v1/members/M001197.json"
        
        // only for house rep.
        district?: string; // "2"
        at_large?: boolean; // false
      }
    }
  }
}
