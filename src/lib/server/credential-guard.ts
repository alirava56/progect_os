/**
 * Defense in depth for accidentally pasted credentials in unencrypted workspace text.
 * These deterministic heuristics deliberately favor rejecting suspicious assignments.
 * IMPORTANT: A heuristic cannot prove a string contains no secret. Never use it as a vault.
 */
const marker = /(?:^|[^\p{L}\p{N}_])(?:password|passwd|pwd|api[_ -]?key|api[_ -]?token|access[_ -]?token|refresh[_ -]?token|auth[_ -]?token|token|client[_ -]?secret|private[_ -]?key|secret|authorization|رمز(?:\s*عبور)?|گذرواژه|توکن|کلید\s*خصوصی)\s*[:=]\s*["'`]?([^\s"'`;,]{4,})/iu;
const privateKey = /-----BEGIN (?:[A-Z ]+ )?PRIVATE KEY-----/i;
const githubToken = /\bgh[pousr]_[A-Za-z0-9_]{20,}\b/;
const openAiToken = /\bsk-(?:proj-)?[A-Za-z0-9_-]{20,}\b/;
const awsAccessKey = /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/;
const jwt = /\beyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/;
const uriCredentials = /(?:https?:\/\/|postgres(?:ql)?:\/\/|mongodb(?:\+srv)?:\/\/)[^\s@/]+:[^\s@/]+@/i;
const placeholders = /^(?:\*{4,}|x{4,}|redacted|masked|example|placeholder|dummy|none|hidden|your[_-].*|\[redacted\]|<redacted>)$/i;
export function suspiciousCredential(text: string): boolean {
  if(privateKey.test(text)||githubToken.test(text)||openAiToken.test(text)||awsAccessKey.test(text)||jwt.test(text)||uriCredentials.test(text))return true;
  const matches=text.matchAll(new RegExp(marker.source,'giu'));
  for(const match of matches)if(!placeholders.test(match[1]))return true;
  return false;
}
export function suspiciousInRecord(value:unknown):boolean {
  if(typeof value==='string')return suspiciousCredential(value);
  if(Array.isArray(value))return value.some(suspiciousInRecord);
  if(value!==null&&typeof value==='object')return Object.values(value).some(suspiciousInRecord);
  return false;
}
export function redactCredentials(text:string):string {
  return text
    .replace(/-----BEGIN (?:[A-Z ]+ )?PRIVATE KEY-----[\s\S]*?-----END (?:[A-Z ]+ )?PRIVATE KEY-----/gi,'[REDACTED PRIVATE KEY]')
    .replace(new RegExp(marker.source,'giu'),'[REDACTED CREDENTIAL]')
    .replace(new RegExp(githubToken.source,'g'),'[REDACTED TOKEN]')
    .replace(new RegExp(openAiToken.source,'g'),'[REDACTED TOKEN]')
    .replace(new RegExp(awsAccessKey.source,'g'),'[REDACTED ACCESS KEY]')
    .replace(new RegExp(jwt.source,'g'),'[REDACTED JWT]')
    .replace(new RegExp(uriCredentials.source,'gi'),'[REDACTED CONNECTION URI]');
}

/** Scrub legacy data before it reaches the browser or an AI retrieval pipeline.
 * This is a best-effort display protection, not a substitute for scanning and purging DB backups. */
export function redactStoredValue(value:unknown):unknown {
  if(typeof value==='string')return redactCredentials(value);
  if(Array.isArray(value))return value.map(redactStoredValue);
  if(value!==null&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([k,v])=>[k,redactStoredValue(v)]));
  return value;
}
