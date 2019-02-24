import { IEntBill } from './';

export type Chamber = 's' | 'h';
export type CongressRoleType = 'senator' | 'representative';
export type CongressMemberTitle = {
  short: string,
  long: string,
};

export class CongressUtils {
  private static readonly STATES = new Set(['ID', 'VA', 'IN', 'SD', 'ME', 'NV', 'AK',
    'WV', 'IA', 'SC', 'WA', 'NH', 'OK', 'LA', 'NY', 'ND', 'NJ', 'MO', 'KS',
    'CT', 'RI', 'UT', 'WY', 'OR', 'AL', 'MN', 'NE', 'TX', 'NC', 'CA', 'OH',
    'KY', 'MT', 'CO', 'MA', 'MD', 'AZ', 'VT', 'NM', 'PA', 'DE', 'TN', 'WI',
    'MS', 'GA', 'AR', 'FL', 'HI', 'MI', 'IL']);
  private static readonly TERRITORIES = new Set(['MP', 'GU', 'AS', 'VI', 'PI', 'DK']);

  public static get ALL_STATE_CODE (): string[] {
    return [...Array.from(CongressUtils.STATES), ...Array.from(CongressUtils. TERRITORIES), 'PR', 'DC'];
  }

  public static getMemberTitle (chamber: Chamber, state: string)
  : CongressMemberTitle {
    if (chamber === 's') {
      if (!CongressUtils.STATES.has(state)) {
        throw Error(`Cannot determine congress member title for `
          + `chamber=${chamber}, state=${state}`);
      }
      return {
        short: 'Sen.',
        long: 'Senator',
      };
    }
    if (CongressUtils.STATES.has(state)) {
      return {
        short: 'Rep.',
        long: 'Representative',
      };
    }
    if (CongressUtils.TERRITORIES.has(state) || state === 'DC') {
      return {
        short: 'Rep.',
        long: 'Delegate',
      };
    }
    if (state === 'PR') {
      return {
        short: 'Commish.',
        long: 'Resident Commissioner',
      };
    }
    throw Error(`Cannot determine congress member title for `
      + `chamber=${chamber}, state=${state}`);
  }

  public static validateState (state: string): string {
    if (CongressUtils.STATES.has(state)) {
      return state;
    }
    if (CongressUtils.TERRITORIES.has(state)) {
      return state;
    }
    if (state === 'DC' || state === 'PR') {
      return state;
    }
  }

  public static displayBill (bill: IEntBill) {
    return `${bill.congress}-${bill.billType}-${bill.billNumber} (${bill._id})`;
  }
}