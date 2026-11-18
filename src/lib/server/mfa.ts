/** RFC 6238 SHA-1 TOTP with encrypted-at-rest per-user seeds. Requires independent deployment key. */
import {createHmac, createHash, randomBytes, createCipheriv, createDecipheriv, timingSafeEqual} from 'node:crypto';
import {getDb} from './db';
function key():Buffer {
  const text=process.env.PROJECTOS_MFA_ENCRYPTION_KEY;
  if(!text||!/^[a-f0-9]{64}$/i.test(text))throw new Error('MFA_KEY_NOT_CONFIGURED');
  return Buffer.from(text,'hex');
}
function encrypt(text:string):string {
  const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',key(),iv);
  cipher.setAAD(Buffer.from('PROJECTOS-MFA-v1'));
  const data=Buffer.concat([cipher.update(text,'utf8'),cipher.final()]);
  return [iv.toString('hex'),cipher.getAuthTag().toString('hex'),data.toString('hex')].join(':');
}
function decrypt(text:string):string {
  const [iv,tag,data]=text.split(':');
  if(!iv||!tag||!data)throw Error('Corrupted MFA secret');
  const cipher=createDecipheriv('aes-256-gcm',key(),Buffer.from(iv,'hex'));
  cipher.setAAD(Buffer.from('PROJECTOS-MFA-v1'));cipher.setAuthTag(Buffer.from(tag,'hex'));
  return Buffer.concat([cipher.update(Buffer.from(data,'hex')),cipher.final()]).toString('utf8');
}
const alphabet='ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
function b32(data:Buffer) {
  let bits=0,value=0,out='';
  for(const byte of data){value=(value<<8)|byte;bits+=8;while(bits>=5){out+=alphabet[(value>>>(bits-=5))&31];}}
  if(bits>0)out+=alphabet[(value<<(5-bits))&31];
  return out;
}
function decode(text:string):Buffer {
  let bits=0,value=0;const bytes:number[]=[];
  for(const c of text){const n=alphabet.indexOf(c);if(n<0)throw Error('Invalid TOTP seed');value=(value<<5)|n;bits+=5;if(bits>=8){bytes.push((value>>>(bits-=8))&255);}}
  return Buffer.from(bytes);
}
export function totp(seed:string,step=Math.floor(Date.now()/30000)):string {
  const buf=Buffer.alloc(8);buf.writeBigUInt64BE(BigInt(step));
  const digest=createHmac('sha1',decode(seed)).update(buf).digest();
  const offset=digest[19]&15;
  return (((digest.readUInt32BE(offset)&0x7fffffff)%1000000).toString()).padStart(6,'0');
}
function matchStep(seed:string,code:unknown,lastStep=-1):number|null {
  if(typeof code!=='string'||!/^[0-9]{6}$/.test(code))return null;
  const step=Math.floor(Date.now()/30000);
  for(let current=step-1;current<=step+1;current++){
    if(current<=lastStep)continue;
    if(timingSafeEqual(Buffer.from(totp(seed,current)),Buffer.from(code)))return current;
  }
  return null;
}
export function ensureMfaSchema(){
  const db=getDb();
  const cols=db.prepare('PRAGMA table_info(users)').all() as {name:string}[];
  for(const [field,sql] of [
    ['mfa_seed',"ALTER TABLE users ADD COLUMN mfa_seed TEXT"],
    ['mfa_pending',"ALTER TABLE users ADD COLUMN mfa_pending TEXT"],
    ['mfa_pending_until',"ALTER TABLE users ADD COLUMN mfa_pending_until INTEGER NOT NULL DEFAULT 0"],
    ['mfa_last_step',"ALTER TABLE users ADD COLUMN mfa_last_step INTEGER NOT NULL DEFAULT -1"],
    ['mfa_failed',"ALTER TABLE users ADD COLUMN mfa_failed INTEGER NOT NULL DEFAULT 0"],
    ['mfa_locked_until',"ALTER TABLE users ADD COLUMN mfa_locked_until INTEGER NOT NULL DEFAULT 0"]
  ] as const){if(!cols.some(c=>c.name===field))db.exec(sql);}
}
export function mfaEnabled(userId:string):boolean {
  ensureMfaSchema();
  return !!(getDb().prepare('SELECT mfa_seed AS seed FROM users WHERE id=?').get(userId) as {seed:string|null}|undefined)?.seed;
}
export function beginMfa(userId:string,email:string){
  ensureMfaSchema();key();
  const seed=b32(randomBytes(20));
  getDb().prepare('UPDATE users SET mfa_pending=?,mfa_pending_until=? WHERE id=?')
    .run(encrypt(seed),Date.now()+10*60*1000,userId);
  return {secret:seed,provisioningUrl:`otpauth://totp/${encodeURIComponent('ProjectOS:'+email)}?secret=${seed}&issuer=ProjectOS&algorithm=SHA1&digits=6&period=30`};
}
export function confirmMfa(userId:string,code:unknown):boolean {
  ensureMfaSchema();
  const db=getDb();
  const row=db.prepare('SELECT mfa_pending AS pending,mfa_pending_until AS expires FROM users WHERE id=?').get(userId) as {pending:string|null;expires:number}|undefined;
  if(!row?.pending||row.expires<Date.now())return false;
  const step=matchStep(decrypt(row.pending),code);
  if(step===null)return false;
  db.prepare('UPDATE users SET mfa_seed=?,mfa_pending=NULL,mfa_pending_until=0,mfa_last_step=?,mfa_failed=0 WHERE id=?')
    .run(row.pending,step,userId);
  return true;
}
export function verifyMfa(userId:string,code:unknown):boolean {
  ensureMfaSchema();
  const db=getDb();
  const row=db.prepare('SELECT mfa_seed AS seed,mfa_last_step AS lastStep,mfa_failed AS failed,mfa_locked_until AS locked FROM users WHERE id=?').get(userId) as {seed:string|null;lastStep:number;failed:number;locked:number}|undefined;
  if(!row?.seed||row.locked>Date.now())return false;
  const step=matchStep(decrypt(row.seed),code,row.lastStep);
  if(step===null){
    const failed=row.failed+1;
    db.prepare('UPDATE users SET mfa_failed=?,mfa_locked_until=? WHERE id=?').run(failed,failed>=5?Date.now()+15*60*1000:0,userId);
    return false;
  }
  // Atomic consume to prevent replay in parallel logins.
  const changed=db.prepare('UPDATE users SET mfa_last_step=?,mfa_failed=0,mfa_locked_until=0 WHERE id=? AND mfa_last_step<?').run(step,userId,step);
  return changed.changes===1;
}

/** Recovery codes are one-use, randomly generated, and SHA-256-hashed in SQLite.
 * Never place raw codes in logs, documents, telemetry or general app state. */
export function ensureRecoverySchema() {
  getDb().exec(`CREATE TABLE IF NOT EXISTS mfa_recovery_codes (
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    code_hash TEXT NOT NULL, created_at TEXT NOT NULL,
    PRIMARY KEY(user_id,code_hash)
  )`);
}
export function issueRecoveryCodes(userId:string):string[] {
  ensureRecoverySchema();
  if(!mfaEnabled(userId))throw Error('MFA_NOT_ENABLED');
  const codes=Array.from({length:10},()=>randomBytes(16).toString('base64url'));
  const db=getDb();
  db.exec('BEGIN IMMEDIATE');
  try {
    db.prepare('DELETE FROM mfa_recovery_codes WHERE user_id=?').run(userId);
    const insert=db.prepare('INSERT INTO mfa_recovery_codes(user_id,code_hash,created_at) VALUES(?,?,?)');
    for(const code of codes)insert.run(userId,createHash('sha256').update(code).digest('hex'),new Date().toISOString());
    db.exec('COMMIT');
  }catch(error){db.exec('ROLLBACK');throw error;}
  return codes;
}
export function verifyRecoveryCode(userId:string,code:unknown):boolean {
  if(typeof code!=='string'||!/^[A-Za-z0-9_-]{22}$/.test(code))return false;
  ensureRecoverySchema();
  const hash=createHash('sha256').update(code).digest('hex');
  const result=getDb().prepare('DELETE FROM mfa_recovery_codes WHERE user_id=? AND code_hash=?').run(userId,hash);
  if(result.changes===1){
    // Account recovery invalidates every pre-existing session before new login.
    getDb().prepare('DELETE FROM sessions WHERE user_id=?').run(userId);
    return true;
  }
  return false;
}
export function remainingRecoveryCodes(userId:string):number {
  ensureRecoverySchema();
  return Number((getDb().prepare('SELECT count(*) AS count FROM mfa_recovery_codes WHERE user_id=?').get(userId) as {count:number}).count);
}
