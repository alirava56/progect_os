import type { SqlExecutor } from './database.mjs';

export function reminderAlertId(workspace: string, kind: string, id: string, due: string, source?: string): string;
export function retireReminderAlert(db: SqlExecutor, workspace: string, id: string): Promise<number>;
