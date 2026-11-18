import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { validRecordId } from '../record-contract';
import { redactCredentials } from './credential-guard';

export type RepositoryBinding = { workspaceId: string; projectId: string; repository: string };
export type RepositorySnapshot = {
  repository: string;
  state: 'connected' | 'unknown' | 'rate_limited' | 'pending_refresh' | 'stale';
  checkedAt: string;
  updatedAt?: string;
  openIssues?: number;
  issues?: Array<{number: number; title: string}>;
  releases?: Array<{tag: string; publishedAt: string | null}>;
  latestDeployment?: {id: number; state: string} | null;
  retryAt?: string;
};

export function githubBindings(value = process.env.PROJECTOS_GITHUB_PROJECTS): RepositoryBinding[] {
  if (!value || value.length > 24_000) return [];
  try {
    const entries: unknown = JSON.parse(value);
    if (!Array.isArray(entries) || entries.length > 50) return [];
    const result: RepositoryBinding[] = [];
    const seen = new Set<string>();
    for (const entry of entries) {
      const row = entry as Partial<RepositoryBinding> | null;
      if (!row || !validRecordId(row.workspaceId) || !validRecordId(row.projectId) || typeof row.repository !== 'string'
        || !/^[A-Za-z0-9][A-Za-z0-9-]{0,38}\/[A-Za-z0-9][A-Za-z0-9_.-]{0,99}$/.test(row.repository) || row.repository.endsWith('.')) return [];
      const normalized = row.repository.toLowerCase();
      const key = JSON.stringify([row.workspaceId, row.projectId, normalized]);
      if (!seen.has(key)) result.push({ workspaceId:row.workspaceId, projectId:row.projectId, repository:normalized });
      seen.add(key);
    }
    return result;
  } catch { return []; }
}

export function signedDelivery(raw: Buffer, signature: string | null, key: string) {
  if (key.length < 24 || !signature || !/^sha256=[0-9a-f]{64}$/.test(signature)) return false;
  return timingSafeEqual(Buffer.from(signature.slice(7), 'hex'), createHmac('sha256', key).update(raw).digest());
}

export function deliveryDigest(raw: Buffer) { return createHash('sha256').update(raw).digest('hex'); }

class GitHubUnavailable extends Error {
  constructor(readonly retryAt?: string) { super('GitHub request unavailable'); }
}

function retryTime(response: Response, now: number) {
  const retry = response.headers.get('retry-after');
  const reset = response.headers.get('x-ratelimit-reset');
  const numeric = retry !== null && /^\d{1,7}$/.test(retry) ? now + Number(retry) * 1000 : NaN;
  const next = Number.isFinite(numeric) ? numeric : reset !== null && /^\d{1,12}$/.test(reset) ? Number(reset) * 1000 : now + 60_000;
  return new Date(Math.min(now + 86400_000, Math.max(next, now + 15_000))).toISOString();
}

type Issue = {number?: unknown; title?: unknown; pull_request?: unknown};
type Release = {tag_name?: unknown; published_at?: unknown};
type Deployment = {id?: unknown};
function records<T>(value: unknown): T[] {
  if (!Array.isArray(value)) throw new Error('Unexpected GitHub response');
  return value.filter(item => item && typeof item === 'object') as T[];
}

export async function syncRepository(repository: string, token: string, request = fetch, clock = new Date()): Promise<RepositorySnapshot> {
  const checkedAt = clock.toISOString();
  async function query(path: string): Promise<unknown> {
    const response = await request('https://api.github.com/repos/' + repository + path, {
      headers:{ Authorization:'Bearer ' + token, Accept:'application/vnd.github+json', 'X-GitHub-Api-Version':'2022-11-28' },
      cache:'no-store', redirect:'error', signal:AbortSignal.timeout(8500),
    });
    if (!response.ok) {
      const limited = response.status === 429 || (response.status === 403
        && (response.headers.has('retry-after') || response.headers.get('x-ratelimit-remaining') === '0'));
      throw new GitHubUnavailable(limited ? retryTime(response, clock.getTime()) : undefined);
    }
    return response.json();
  }
  try {
    // A repository quota response avoids launching follow-up requests.
    const overview = await query('') as { pushed_at?: unknown; open_issues_count?: unknown };
    const [issueItems, releaseItems, deployItems] = await Promise.all([
      query('/issues?state=open&per_page=10'), query('/releases?per_page=5'), query('/deployments?per_page=1'),
    ]);
    const issues = records<Issue>(issueItems).filter(issue => !issue.pull_request && typeof issue.number === 'number'
      && Number.isSafeInteger(issue.number) && typeof issue.title === 'string').slice(0,10)
      .map(issue => ({number:issue.number as number, title:redactCredentials((issue.title as string).slice(0,160))}));
    const releases = records<Release>(releaseItems).filter(release => typeof release.tag_name === 'string').slice(0,5)
      .map(release => ({tag:redactCredentials((release.tag_name as string).slice(0,100)),
        publishedAt:typeof release.published_at === 'string' && Number.isFinite(Date.parse(release.published_at)) ? release.published_at : null}));
    const deploymentId = records<Deployment>(deployItems)[0]?.id;
    let latestDeployment: RepositorySnapshot['latestDeployment'] = null;
    if (typeof deploymentId === 'number' && Number.isSafeInteger(deploymentId) && deploymentId > 0) {
      const statuses = records<{state:unknown}>(await query('/deployments/' + deploymentId + '/statuses?per_page=1'));
      const initial = statuses[0]?.state;
      const state = typeof initial === 'string' && ['error','failure','inactive','in_progress','queued','pending','success'].includes(initial)
        ? initial : 'unknown';
      latestDeployment = {id:deploymentId, state};
    }
    return {
      repository, checkedAt, state:'connected',
      updatedAt:typeof overview?.pushed_at === 'string' && Number.isFinite(Date.parse(overview.pushed_at)) ? overview.pushed_at : undefined,
      openIssues:typeof overview?.open_issues_count === 'number' && Number.isSafeInteger(overview.open_issues_count) ? overview.open_issues_count : undefined,
      issues, releases, latestDeployment,
    };
  } catch (error) {
    const retryAt = error instanceof GitHubUnavailable ? error.retryAt : undefined;
    return { repository, checkedAt, state:retryAt ? 'rate_limited' : 'unknown', retryAt };
  }
}