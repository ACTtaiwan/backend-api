import { IEnt, Chamber, Type, TextVersionCode, IAssoc } from './';
import * as s3Lib from '../s3Lib';
import * as congressGov from '../congressGov/CongressGovModels';

export interface IEntPerson extends IEnt {
  _type: Type.Person;

  // basic info
  firstName: string;
  lastName: string;
  middleName?: string;
  nickname?: string;
  nameSuffix?: string;
  gender?: 'male' | 'female';
  birthday?: string; // e.g., '1960-05-10'

  // affiliations
  website?: string;
  office?: string;
  phone?: string;

  // external & social IDs
  bioGuideId: string;
  govTrackId?: string;
  osId?: string;
  pvsId?: string;
  cspanId?: string;
  twitterId?: string; // e.g., 'RepJohnCurtis'
  facebookId?: string; // e.g., 'CongressmanRalphAbraham'
  youtubeId?: string;

  // pics
  profilePictures?: IEntPersonProfilePicture;

  // roles
  congressRoles?: IEntPersonRole[];
}

export type IEntPersonProfilePicture = {[res in s3Lib.ProfilePictureResolution]?: string};

export type IEntPersonRoleParty =
    'Democrat'
  | 'Republican'
  | 'Populist'
  | 'Unionist'
  | 'Whig'
  | 'Jackson'
  | 'Federalist'
  | 'Ind. Republican-Democrat'
  | 'Nullifier'
  | 'Independent'
  | 'Liberal Republican'
  | 'Adams'
  | 'Popular Democrat'
  | 'Ind. Democrat'
  | 'Pro-Administration'
  | 'Anti-Lecompton Democrat'
  | 'Jacksonian'
  | 'Anti-Jacksonian'
  | 'Unconditional Unionist'
  | 'Anti-Administration'
  | 'Law and Order'
  | 'Adams Democrat'
  | 'National Greenbacker'
  | 'American'
  | 'New Progressive'
  | 'Anti Masonic'
  | 'Democratic Republican'
  | 'Silver Republican'
  | 'Progressive'
  | 'Free Silver'
  | 'Anti Jacksonian'
  | 'Ind. Republican'
  | 'Free Soil'
  | 'Nonpartisan'
  | 'Republican-Conservative'
  | 'Readjuster'
  | 'States Rights'
  | 'Conservative Republican'
  | 'Union Labor'
  | 'Ind. Whig'
  | 'Unknown'
  | 'Readjuster Democrat'
  | 'American Labor'
  | 'Conservative'
  | 'Coalitionist'
  | 'Crawford Republican'
  | 'Farmer-Labor'
  | 'Liberal'
  | 'AL'
  | 'Union'
  | 'Anti Jackson'
  | 'Liberty'
  | 'Union Democrat'
  | 'Anti Mason'
  | 'Anti-administration'
  | 'Pro-administration'
  | 'Democratic and Union Labor'
  | 'Prohibitionist'
  | 'Constitutional Unionist'
  | 'Socialist'
  | 'Silver'
  | 'Jackson Republican'
  | 'Independent Democrat'
  | 'Jacksonian Republican'
  | 'Progressive Republican'
  | 'Democrat-Liberal';

export interface IEntPersonRole {
  congressNumbers: number[];
  chamber: Chamber;
  startDate: number;
  endDate: number;
  party: IEntPersonRoleParty;
  state: string; // values defined in CongressUtils.ALL_STATE_CODE
  district?: number;
  senatorClass?: number;
}

export interface IEntBill extends IEnt {
  _type: Type.Bill;
  congress: number;
  billType: congressGov.BillTypeCode;
  billNumber: number;
  title: string;
  title_zh?: string;
  introducedDate?: number; // UTC time

  // Taiwan Watch fields
  summary?: string;
  summary_zh?: string;
  relevance?: number;

  // Congress.gov all-info
  trackers?: congressGov.Tracker[];
  s3Entity?: string; // static content stored in S3

  // full text
  versions?: TextVersion[];
  actions?: congressGov.CongressGovAction[];
  actionsAll?: congressGov.CongressGovAction[];
}

export interface TextVersion {
  code: TextVersionCode;
  date?: number; // UTC time
  documents?: S3TextDocument[];
}

export interface S3TextDocument {
  s3Entity: string;
  contentType?: s3Lib.BillTextContentType;
}

export interface IAssocSponsorAssoc extends IAssoc {
  _type: Type.Sponsor;
}

export interface IAssocCosponsorAssoc extends IAssoc {
  _type: Type.Cosponsor;
  date: number; // cosponsor date
}
