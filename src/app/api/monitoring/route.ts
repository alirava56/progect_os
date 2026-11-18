import { NextResponse } from 'next/server';
import { getCurrentAccount } from '@/lib/server/auth';
import { loadState, sql } from '@/lib/server/db';
import { apiError, noStore } from '@/lib/server/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const account = await getCurrentAccount();
  if (!account) return apiError('Unauthenticated', 401);
  const {data} = await loadState(account);
  const allowed = new Set(data.resources.map(resource => resource.id));
  const [rows, machineRows] = await Promise.all([
    sql.all<{resourceId: string; checkedAt: string; state: string; statusCode: number | null; latencyMs: number | null; source: string; tlsExpiresAt: string | null}>(
      `SELECT resource_id AS "resourceId",checked_at AS "checkedAt",state,status_code AS "statusCode",
        latency_ms AS "latencyMs",source,tls_expires_at AS "tlsExpiresAt"
        FROM monitor_observations WHERE workspace_id=? ORDER BY checked_at DESC LIMIT 200`,account.workspaceId),
    sql.all<{resourceId: string; checkedAt: string; cpuPercent: number; usedBytes: number; totalBytes: number}>(
      `SELECT resource_id AS "resourceId",checked_at AS "checkedAt",cpu_percent AS "cpuPercent",
        used_bytes AS "usedBytes",total_bytes AS "totalBytes"
        FROM machine_observations WHERE workspace_id=? ORDER BY checked_at DESC LIMIT 200`,account.workspaceId),
  ]);
  const now = Date.now();
  const freshnessWindowMinutes = 15;
  const observations = rows.filter(row => allowed.has(row.resourceId)).map(row => {
    const age = now - Date.parse(row.checkedAt);
    const state = Number.isFinite(age) && age >= -60_000 && age <= freshnessWindowMinutes * 60_000 ? row.state : 'stale';
    return {...row, state, recordedState: row.state};
  });
  const machineObservations = machineRows.filter(row => allowed.has(row.resourceId)).map(row => {
    const age = now - Date.parse(row.checkedAt);
    return {...row,source:'machine-agent',state:age>=-120000&&age<=freshnessWindowMinutes*60000?'observed':'stale'};
  });
  const status = observations.length || machineObservations.length || process.env.PROJECTOS_MONITOR_HOSTS ? 'configured' : 'not_configured';
  return NextResponse.json({ observations, machineObservations, status, freshnessWindowMinutes }, { headers: noStore });
}
