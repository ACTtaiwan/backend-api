export interface ISubscribeAgent {
  subscribe (email: string, firstName?: string, lastName?: string, list?: 'act' | 'ustw' );
}
