import type { DatabaseSync } from 'node:sqlite';

export type SqlParam = string | number | null;
export interface SqlExecutor {
  readonly dialect: 'sqlite' | 'postgres';
  scopeWorkspace?(workspaceId: string): Promise<void>;
  all<Row>(statement: string, ...params: SqlParam[]): Promise<Row[]>;
  one<Row>(statement: string, ...params: SqlParam[]): Promise<Row | undefined>;
  run(statement: string, ...params: SqlParam[]): Promise<number>;
}
export function getDb(): DatabaseSync;
export function postgresConfigured(): boolean;
export function closeDatabase(): Promise<void>;
export const sql: SqlExecutor;
export function transaction<T>(action: (db: SqlExecutor) => Promise<T>): Promise<T>;
export function readTransaction<T>(action: (db: SqlExecutor) => Promise<T>): Promise<T>;
export function lockWorkspace(db: SqlExecutor, workspaceId: string): Promise<{version: number; name: string} | undefined>;
export function lockBootstrap(db: SqlExecutor): Promise<void>;
