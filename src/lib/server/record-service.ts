/** Single-record API adapter. Validates the entire resulting state so cross-record relations remain sound. */
import type { DemoData } from '../types';
import { loadStateForRecordMutation, saveState, ForbiddenError, VersionConflictError, type Account } from './db';
import { parseState, ValidationError } from './validation';

export const RECORD_KINDS = ['projects','tasks','resources','secrets','reminders','incidents','expenses','charges','contracts','revenues','docs'] as const;
export type RecordKind = typeof RECORD_KINDS[number];
export function isRecordKind(value:string):value is RecordKind {
  return (RECORD_KINDS as readonly string[]).includes(value);
}
export class MissingRecordError extends Error {}
export class DuplicateRecordError extends Error {}
export function mutateRecord(account:Account, expectedVersion:number, kind:RecordKind, id:string, action:'create'|'replace'|'delete', input?:unknown) {
  if(account.role!=='owner'&&!(account.role==='editor'&&['tasks','docs','reminders','incidents'].includes(kind)))throw new ForbiddenError();
  if(!Number.isSafeInteger(expectedVersion)||expectedVersion<0)throw new ValidationError('Invalid revision');
  if(id.length>100||!id||/[\/\\\u0000-\u001f]/.test(id))throw new ValidationError('Invalid record identifier');
  const {data,version}=loadStateForRecordMutation(account);
  if(version!==expectedVersion)throw new VersionConflictError();
  const next=structuredClone(data) as DemoData;
  const list=next[kind] as unknown as Array<{id:string}>;
  const index=list.findIndex(item=>item.id===id);
  if(action==='create'&&index!==-1)throw new DuplicateRecordError();
  if(action!=='create'&&index===-1)throw new MissingRecordError();
  if(action==='delete')list.splice(index,1);
  else {
    if(input===null||typeof input!=='object'||Array.isArray(input)||(input as {id?:unknown}).id!==id)
      throw new ValidationError('Record id mismatch');
    if(action==='create')list.push(input as {id:string});
    else list[index]=input as {id:string};
  }
  // parseState checks all project relations, dates, uniqueness, cyclic dependencies and field allowlists.
  const canonical=parseState(next);
  return saveState(account,expectedVersion,canonical,account.role==='editor');
}
