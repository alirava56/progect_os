import type { DemoData } from './types';

export const recordKinds = [
  'projects', 'tasks', 'resources', 'secrets', 'reminders', 'incidents',
  'expenses', 'charges', 'contracts', 'revenues', 'docs', 'invoices', 'payments',
] as const;
export type RecordKind = typeof recordKinds[number];
export type WorkspaceRecord = DemoData[RecordKind][number];
export type RecordChange = {
  kind: RecordKind;
  id: string;
  action: 'create' | 'replace' | 'delete';
  record?: unknown;
};
export function isRecordKind(value: unknown): value is RecordKind {
  return typeof value === 'string' && (recordKinds as readonly string[]).includes(value);
}
export function validRecordId(id: unknown): id is string {
  return typeof id === 'string' && id.length > 0 && id.length <= 100 && !/[\/\\\u0000-\u001f]/.test(id);
}
