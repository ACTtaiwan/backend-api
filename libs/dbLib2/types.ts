import { Binary } from 'bson';

export type Id = string;

export enum EntityTypes {
  Bill = 'Bill',
  Person = 'Person',
}
export type EntityType = keyof typeof EntityTypes;

// export enum AssocTypes {
//   PlayRole = 'PlayRole',
//   SponsorBill = 'SponsorBill',
//   CosponsorBill = 'CosponsorBill',
// };
// export type AssocType = keyof typeof AssocTypes;
// export enum AssocDirection { In, Out }
// export interface AssocDefinitions {
//   [name: string]: {
//     type: AssocType,
//     dir: AssocDirection,
//   },
// }


export type Chamber = 's' | 'h';
export type SenatorRank = 'senior' | 'junior';