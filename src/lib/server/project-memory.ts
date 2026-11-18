import { canSeeProject, projectPolicy, readTransaction, storedRecord, type Account } from './db';
import { MissingRecordError } from './record-service';
import { redactCredentials, redactStoredValue, suspiciousCredential } from './credential-guard';

export type Citation = {
  id: string; kind: 'doc' | 'task' | 'project' | 'reminder';
  projectId: string; title: string; href: string; updatedAt: string; excerpt: string;
};

export function normalizePersian(value: string) {
  return value.normalize('NFKC').toLowerCase().replaceAll('ي', 'ی').replaceAll('ك', 'ک')
    .replace(/[\u200c\u200d]/g, ' ').replace(/\s+/g, ' ').trim();
}

type MemoryRow = { kind: 'docs' | 'tasks' | 'projects' | 'reminders'; id: string; project_id: string; updated_at: string; payload: string };
type MemoryPayload = { title?: string; name?: string; body?: string; description?: string; due?: string; kind?: string };
const paths = {
  docs: { kind: 'doc', href: (id: string) => '/docs?doc=' + encodeURIComponent(id) },
  tasks: { kind: 'task', href: (id: string) => '/tasks/' + encodeURIComponent(id) },
  projects: { kind: 'project', href: (id: string) => '/projects/' + encodeURIComponent(id) },
  reminders: { kind: 'reminder', href: () => '/calendar' },
} as const;

export async function retrieveMemory(account: Account, query: string, projectId?: string): Promise<Citation[]> {
  return readTransaction(async db => {
    const policy = await projectPolicy(db, account);
    if (projectId && (!canSeeProject(policy, projectId) || !await storedRecord(db, account.workspaceId, 'projects', projectId))) {
      throw new MissingRecordError();
    }
    const scope = projectId ? [projectId] : policy.projectIds ? [...policy.projectIds] : undefined;
    if (scope && !scope.length) return [];
    const clauses = scope ? ' AND project_id IN (' + scope.map(() => '?').join(',') + ')' : '';
    const rows = await db.all<MemoryRow>(`SELECT kind,id,project_id,updated_at,payload FROM records WHERE workspace_id=?
      AND kind IN ('docs','tasks','projects','reminders')${clauses} ORDER BY updated_at DESC,id LIMIT 2000`,
    account.workspaceId, ...(scope ?? []));
    const terms = [...new Set(normalizePersian(query).split(/[^\p{L}\p{N}]+/u).filter(term => term.length > 1))];
    return rows.flatMap(row => {
      const {kind, href} = paths[row.kind];
      const value = redactStoredValue(JSON.parse(row.payload)) as MemoryPayload;
      const title = redactCredentials(value.title ?? value.name ?? '').slice(0, 180);
      const excerpt = redactCredentials(value.body ?? value.description ?? [value.kind, value.due].filter(Boolean).join(' · ')).slice(0, 850);
      const titleKey = normalizePersian(title), textKey = normalizePersian(excerpt);
      const score = terms.reduce((sum, term) => sum + (titleKey.includes(term) ? 4 : 0) + (textKey.includes(term) ? 1 : 0), 0);
      return score && title ? [{ score, citation: {
        id: kind + ':' + row.id, kind, title, href: href(row.id), projectId: row.project_id, updatedAt: row.updated_at, excerpt,
      } }] : [];
    }).sort((left, right) => right.score - left.score).slice(0, 6).map(item => item.citation);
  });
}

/** Provider output is untrusted. Display only literal, attributable fragments of submitted sources. */
export function verifyQuotes(text: string, citations: Citation[]) {
  let output: unknown;
  try { output = JSON.parse(text); } catch { return []; }
  const quotes = (output as { quotes?: unknown })?.quotes;
  if (!Array.isArray(quotes) || !quotes.length || quotes.length > 5) return [];
  const verified: Array<{citation: Citation; quote: string}> = [];
  for (const item of quotes) {
    const {id, quote} = item as {id?: unknown; quote?: unknown} ?? {};
    const citation = citations.find(candidate => candidate.id === id);
    if (!citation || typeof quote !== 'string' || quote.trim() !== quote || quote.length < 6 || quote.length > 240
      || suspiciousCredential(quote) || !citation.excerpt.includes(quote)) return [];
    verified.push({ citation, quote });
  }
  return verified;
}
