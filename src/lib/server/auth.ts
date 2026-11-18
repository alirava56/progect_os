import { createHash, randomBytes, randomUUID, scryptSync, timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';
import type { NextRequest } from 'next/server';
import { accountByUser, getDb, transaction, userCount, type Account } from './db';

export const COOKIE = process.env.NODE_ENV==='production' ? '__Host-projectos_session' : 'projectos_session';
const SESSION_SECONDS=7*24*60*60;
const SESSION_IDLE_MS=24*60*60*1000;
const hashed = (token:string) => createHash('sha256').update(token).digest('hex');
const safeEq=(a:string,b:string) => {
  const x=createHash('sha256').update(a).digest(), y=createHash('sha256').update(b).digest();
  return timingSafeEqual(x,y);
};
export function passwordHash(password:string,salt:string){return scryptSync(password,salt,64,{N:16384,r:8,p:1}).toString('hex');}
export function checkOrigin(request:NextRequest) {
  const origin = request.headers.get('origin');
  // Require an explicit, same-origin browser request; never trust forwarded host headers.
  const declared=process.env.PROJECTOS_PUBLIC_ORIGIN;
  // Production must declare a canonical origin; never derive it from untrusted Host headers.
  if(process.env.NODE_ENV==='production'&&!declared)return false;
  const expected=declared||request.nextUrl.origin;
  return !!origin && origin===expected && ['same-origin','none',null].includes(request.headers.get('sec-fetch-site'));
}
export function validatePassword(password:unknown) {
  return typeof password==='string' && password.length >=12 && password.length <=128 && !/[\u0000-\u001f]/.test(password);
}
export function normalizeEmail(email:unknown):string | null {
  if(typeof email!=='string')return null;
  const normalized=email.trim().toLowerCase();
  return normalized.length<=254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)?normalized:null;
}
export function setupOwner(input:{setupToken:unknown;email:unknown;password:unknown;displayName:unknown;workspace:unknown}) {
  const setup = process.env.PROJECTOS_SETUP_TOKEN;
  if (!setup || setup.length <24 || typeof input.setupToken!=='string' || !safeEq(input.setupToken,setup)) throw new Error('SETUP_FORBIDDEN');
  const email=normalizeEmail(input.email), password=input.password, displayName=typeof input.displayName==='string'?input.displayName.trim():'', workspace=typeof input.workspace==='string'?input.workspace.trim():'';
  if(!email || !validatePassword(password) || !displayName || displayName.length>80 || !workspace || workspace.length>80) throw new Error('INVALID_INPUT');
  return transaction(db=>{
    const exists=(db.prepare('SELECT COUNT(*) AS count FROM users').get() as {count:number}).count;
    if(exists) throw new Error('SETUP_CLOSED');
    const id=randomUUID(), ws=randomUUID(),salt=randomBytes(24).toString('hex'),now=new Date().toISOString();
    db.prepare('INSERT INTO users(id,email,display_name,password_hash,salt,created_at) VALUES(?,?,?,?,?,?)').run(id,email,displayName,passwordHash(password as string,salt),salt,now);
    db.prepare('INSERT INTO workspaces(id,name,created_at) VALUES(?,?,?)').run(ws,workspace,now);
    db.prepare('INSERT INTO memberships(user_id,workspace_id,role) VALUES(?,?,?)').run(id,ws,'owner');
    return id;
  });
}

export function authenticate(email:unknown,password:unknown):string|null {
  const normalized=normalizeEmail(email);
  if(!normalized||typeof password!=='string'||password.length>128)return null;
  const db=getDb();
  const row=db.prepare('SELECT id,password_hash,salt,failed_logins,locked_until FROM users WHERE email=?').get(normalized) as {id:string;password_hash:string;salt:string;failed_logins:number;locked_until:number}|undefined;
  const fallbackSalt='00'.repeat(24),fallbackHash='00'.repeat(64);
  const attempt=passwordHash(password,row?.salt??fallbackSalt);
  const expected=Buffer.from(row?.password_hash??fallbackHash,'hex');
  const valid=expected.length===64 && timingSafeEqual(Buffer.from(attempt,'hex'),expected);
  if(!row)return null;
  if(row.locked_until>Date.now())return null;
  if(!valid){
    const fails=row.failed_logins+1;
    db.prepare('UPDATE users SET failed_logins=?,locked_until=? WHERE id=?').run(fails,fails>=5?Date.now()+15*60*1000:0,row.id);
    return null;
  }
  db.prepare('UPDATE users SET failed_logins=0,locked_until=0 WHERE id=?').run(row.id);
  return row.id;
}

export function newSession(userId:string) {
  const token=randomBytes(32).toString('base64url');
  const timestamp=Date.now();
  const db=getDb();
  db.prepare('DELETE FROM sessions WHERE expires_at<?').run(timestamp);
  db.prepare('INSERT INTO sessions(token_hash,user_id,created_at,expires_at,last_seen_at) VALUES(?,?,?,?,?)')
    .run(hashed(token),userId,timestamp,timestamp+SESSION_SECONDS*1000,timestamp);
  return token;
}
export async function setSessionCookie(token:string) {
  (await cookies()).set(COOKIE,token,{httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'strict',path:'/',maxAge:SESSION_SECONDS});
}
/** Signed-in session lookup with absolute and idle expiry; throttled activity touch. */
export function lookupSessionUserId(token:string):string|null {
  if(!token||token.length>128)return null;
  const now=Date.now(),tokenHash=hashed(token),db=getDb();
  const row=db.prepare('SELECT user_id AS id,last_seen_at AS lastSeen FROM sessions WHERE token_hash=? AND expires_at>? AND last_seen_at>?')
    .get(tokenHash,now,now-SESSION_IDLE_MS) as {id:string;lastSeen:number}|undefined;
  if(!row)return null;
  if(now-row.lastSeen>60_000)db.prepare('UPDATE sessions SET last_seen_at=? WHERE token_hash=? AND last_seen_at<?')
    .run(now,tokenHash,now-60_000);
  return row.id;
}
export async function getCurrentAccount():Promise<Account|null> {
  const token=(await cookies()).get(COOKIE)?.value;
  const userId=token?lookupSessionUserId(token):null;
  return userId?accountByUser(userId):null;
}
export async function signOut() {
  const jar=await cookies();
  const token=jar.get(COOKIE)?.value;
  if(token)getDb().prepare('DELETE FROM sessions WHERE token_hash=?').run(hashed(token));
  jar.delete(COOKIE);
}
export { userCount };

/** Reject oversized request bodies *during* streaming, before buffering or parsing JSON. */
export class RequestBodyTooLargeError extends Error {
  constructor(){super('Request body exceeds allowed byte limit');}
}
export async function readLimitedJson(request:NextRequest,maxBytes=4096):Promise<unknown> {
  if(!Number.isSafeInteger(maxBytes)||maxBytes<1)throw new Error('Invalid body limit');
  if(!/^application\/json(?:\s*;|$)/i.test(request.headers.get('content-type')??''))throw Error('JSON content type required');
  const length=request.headers.get('content-length');
  if(length!==null){
    if(!/^\d+$/.test(length)||!Number.isSafeInteger(Number(length)))throw Error('Invalid Content-Length');
    if(Number(length)>maxBytes)throw new RequestBodyTooLargeError();
  }
  const reader=request.body?.getReader();
  if(!reader)throw Error('Empty request body');
  const parts:Uint8Array[]=[];
  let consumed=0;
  try {
    while(true){
      const {done,value}=await reader.read();
      if(done)break;
      consumed+=value.byteLength;
      if(consumed>maxBytes){await reader.cancel('Body exceeds limit');throw new RequestBodyTooLargeError();}
      parts.push(value);
    }
  }finally{reader.releaseLock();}
  return JSON.parse(Buffer.concat(parts.map(part=>Buffer.from(part)),consumed).toString('utf8'));
}
