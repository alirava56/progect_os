import { NextRequest, NextResponse } from 'next/server';
import { checkOrigin, getCurrentAccount, rateLimit, readLimitedJson } from '@/lib/server/auth';
import { canSeeProject, projectPolicy, sql, loadRecord, type Account } from '@/lib/server/db';
import { apiError, jsonError, noStore } from '@/lib/server/http';
import { githubBindings, syncRepository, type RepositoryBinding, type RepositorySnapshot } from '@/lib/server/github';
import { validRecordId } from '@/lib/record-contract';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function bindings(account: Account) {
  return githubBindings().filter(binding => binding.workspaceId === account.workspaceId);
}
async function snapshot(binding: RepositoryBinding) {
  const row = await sql.one<{status:string;payload:string}>(`SELECT status,payload FROM github_snapshots WHERE workspace_id=?
    AND project_id=? AND repo=?`, binding.workspaceId, binding.projectId, binding.repository);
  if (!row) return;
  return {...JSON.parse(row.payload) as RepositorySnapshot, repository:binding.repository, state:row.status as RepositorySnapshot['state']};
}

export async function GET(request: NextRequest) {
  const account = await getCurrentAccount();
  if (!account) return apiError('Unauthenticated', 401);
  const projectId=request.nextUrl.searchParams.get('projectId');
  if (projectId===null && account.role !== 'owner') return apiError('Forbidden', 403);
  const policy=await projectPolicy(sql, account);
  if (projectId!==null && (!validRecordId(projectId) || !canSeeProject(policy,projectId)
    || !await loadRecord(account,'projects',projectId))) return apiError('Not found',404);
  const configured = bindings(account).filter(binding=>projectId===null || binding.projectId===projectId);
  const repositories = await Promise.all(configured.map(async binding => {
    if (!await loadRecord(account, 'projects', binding.projectId)) return;
    const latest = await snapshot(binding);
    if (!latest) return {repository:binding.repository,projectId:binding.projectId,state:'unknown',checkedAt:null};
    const age = Date.now() - Date.parse(latest.checkedAt);
    const state = latest.state === 'connected' && (!Number.isFinite(age) || age < 0 || age > 15 * 60_000) ? 'stale' : latest.state;
    return {...latest,projectId:binding.projectId,state};
  }));
  return NextResponse.json({ status:configured.length && process.env.PROJECTOS_GITHUB_TOKEN ? 'configured' : 'not_configured',
    repositories:repositories.filter(Boolean) }, {headers:noStore});
}

export async function POST(request: NextRequest) {
  if (!checkOrigin(request)) return apiError('Origin rejected', 403);
  const account = await getCurrentAccount();
  if (!account) return apiError('Unauthenticated', 401);
  if (account.role !== 'owner') return apiError('Forbidden', 403);
  await projectPolicy(sql, account);
  const token = process.env.PROJECTOS_GITHUB_TOKEN;
  if (!token) return apiError('GitHub is not configured', 503);
  let input: unknown;
  try { input = await readLimitedJson(request, 2048); }
  catch (error) { return jsonError(error); }
  const {projectId, repository, backfill} = (input ?? {}) as {projectId?:unknown; repository?:unknown; backfill?:unknown};
  if (!validRecordId(projectId) || typeof repository !== 'string' || (backfill!==undefined && typeof backfill!=='boolean')) {
    return apiError('Invalid repository mapping', 422);
  }
  const binding = bindings(account).find(row => row.projectId === projectId && row.repository === repository);
  if (!binding || !await loadRecord(account, 'projects', projectId)) return apiError('Not found', 404);
  const limited = await rateLimit('github:sync', JSON.stringify([account.workspaceId,projectId,repository]), 5, 60_000);
  if (!limited.allowed) return apiError('Try again later', 429, {'Retry-After':String(limited.retryAfter)});
  const previous = await snapshot(binding);
  if (previous?.retryAt && Date.parse(previous.retryAt) > Date.now()) return apiError('Rate limited by GitHub', 429,
    {'Retry-After':String(Math.ceil((Date.parse(previous.retryAt) - Date.now())/1000))});
  const next = await syncRepository(repository, token, fetch, new Date(), backfill===true);
  await sql.run(`INSERT INTO github_snapshots(workspace_id,project_id,repo,checked_at,status,payload) VALUES(?,?,?,?,?,?)
    ON CONFLICT(workspace_id,project_id,repo) DO UPDATE SET checked_at=excluded.checked_at,status=excluded.status,payload=excluded.payload
    WHERE github_snapshots.checked_at<=excluded.checked_at`,
  account.workspaceId, projectId, repository, next.checkedAt, next.state, JSON.stringify(next));
  return NextResponse.json({ ...next,projectId }, {headers:noStore});
}
