import {NextResponse} from 'next/server';
import {getCurrentAccount} from '@/lib/server/auth';
import {getDb} from '@/lib/server/db';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function GET(){
  const account=await getCurrentAccount();
  if(!account)return NextResponse.json({error:'Unauthenticated'},{status:401});
  // Monitor worker creates this table on its first configured run; absent means unknown, NOT healthy.
  const db=getDb();
  const present=db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='monitor_observations'").get();
  if(!present)return NextResponse.json({observations:[],status:'not_configured'},{headers:{'Cache-Control':'no-store'}});
  const rows=db.prepare(`SELECT resource_id AS resourceId, checked_at AS checkedAt, state, status_code AS statusCode, latency_ms AS latencyMs
    FROM monitor_observations WHERE workspace_id=? ORDER BY checked_at DESC LIMIT 200`).all(account.workspaceId);
  const checked=rows as Array<{resourceId:string;checkedAt:string;state:string;statusCode:number|null;latencyMs:number|null}>;
  const now=Date.now();
  return NextResponse.json({observations:checked.map(row=>({ ...row,
    state:Number.isFinite(Date.parse(row.checkedAt))&&now-Date.parse(row.checkedAt)>=-60000&&now-Date.parse(row.checkedAt)<=15*60*1000?row.state:'stale',
    recordedState:row.state})),status:'configured',freshnessWindowMinutes:15},{headers:{'Cache-Control':'no-store'}});
}
