/** Invite-only workspace memberships. Invite codes are random, expire, and never persist in plaintext. */
import {randomBytes,randomUUID,createHash} from 'node:crypto';
import {getDb,transaction,type Account,ForbiddenError} from './db';
import {normalizeEmail,passwordHash,validatePassword,authenticate} from './auth';
import {mfaEnabled,verifyMfa,verifyRecoveryCode} from './mfa';
const codeHash=(value:string)=>createHash('sha256').update(value).digest('hex');
function schema(){getDb().exec(`CREATE TABLE IF NOT EXISTS workspace_invites (
  id TEXT PRIMARY KEY,workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  email TEXT NOT NULL, role TEXT NOT NULL CHECK(role IN ('editor','viewer')),
  token_hash TEXT NOT NULL UNIQUE,expires_at INTEGER NOT NULL, created_at INTEGER NOT NULL,
  redeemed_at INTEGER, revoked_at INTEGER
);CREATE INDEX IF NOT EXISTS idx_invites_workspace ON workspace_invites(workspace_id,created_at DESC);`);}
export class InvitationError extends Error {}
export function createInvitation(owner:Account,email:unknown,role:unknown){
  if(owner.role!=='owner')throw new ForbiddenError();
  const normalized=normalizeEmail(email);
  if(!normalized||!['editor','viewer'].includes(String(role)))throw new InvitationError('INVALID_INVITATION');
  schema();
  const token=randomBytes(32).toString('base64url'),id=randomUUID(),createdAt=Date.now(),expiresAt=createdAt+48*3600*1000;
  transaction(db=>{
    const active=(db.prepare('SELECT count(*) AS n FROM workspace_invites WHERE workspace_id=? AND revoked_at IS NULL AND redeemed_at IS NULL AND expires_at>?').get(owner.workspaceId,createdAt) as {n:number}).n;
    if(active>=20)throw new InvitationError('TOO_MANY_INVITES');
    // Do not let one email accumulate multiple active invitations.
    db.prepare('UPDATE workspace_invites SET revoked_at=? WHERE workspace_id=? AND email=? AND revoked_at IS NULL AND redeemed_at IS NULL').run(createdAt,owner.workspaceId,normalized);
    db.prepare('INSERT INTO workspace_invites(id,workspace_id,email,role,token_hash,expires_at,created_at) VALUES(?,?,?,?,?,?,?)')
      .run(id,owner.workspaceId,normalized,role as 'editor'|'viewer',codeHash(token),expiresAt,createdAt);
  });
  return {id,token,expiresAt};
}
export function listInvitations(owner:Account){
  if(owner.role!=='owner')throw new ForbiddenError();schema();
  const list=getDb().prepare(`SELECT id,email,role,created_at AS createdAt,expires_at AS expiresAt,
    redeemed_at AS redeemedAt,revoked_at AS revokedAt FROM workspace_invites WHERE workspace_id=? ORDER BY created_at DESC LIMIT 100`).all(owner.workspaceId) as Array<{id:string;email:string;role:string;expiresAt:number;redeemedAt:number|null;revokedAt:number|null}>;
  return list.map(i=>({...i,active:!i.redeemedAt&&!i.revokedAt&&i.expiresAt>Date.now()}));
}
export function revokeInvitation(owner:Account,id:string){
  if(owner.role!=='owner')throw new ForbiddenError();schema();
  return getDb().prepare('UPDATE workspace_invites SET revoked_at=? WHERE workspace_id=? AND id=? AND redeemed_at IS NULL AND revoked_at IS NULL')
    .run(Date.now(),owner.workspaceId,id).changes===1;
}
export function acceptInvitation(input:{token:unknown;email:unknown;password:unknown;displayName:unknown;totp?:unknown;recoveryCode?:unknown}){
  const email=normalizeEmail(input.email),password=input.password,name=typeof input.displayName==='string'?input.displayName.trim():'';
  if(typeof input.token!=='string'||!/^[A-Za-z0-9_-]{43}$/.test(input.token)||!email||!validatePassword(password)||!name||name.length>80)
    throw new InvitationError('INVALID_INVITATION');
  schema();
  // Reject invalid/expired invite codes before attempting password verification;
  // otherwise an attacker can lock out arbitrary users with bogus invite tokens.
  const preliminary=getDb().prepare('SELECT id FROM workspace_invites WHERE token_hash=? AND email=? AND revoked_at IS NULL AND redeemed_at IS NULL AND expires_at>?')
    .get(codeHash(input.token as string),email,Date.now()) as {id:string}|undefined;
  if(!preliminary)throw new InvitationError('INVALID_INVITATION');
  // Verify password outside invitation transaction: failed-login counters must persist.
  const preexisting=getDb().prepare('SELECT id FROM users WHERE email=?').get(email) as {id:string}|undefined;
  if(preexisting&&authenticate(email,password)!==preexisting.id)throw new InvitationError('INVALID_INVITATION');
  // A member with MFA enabled must not be able to create a new authenticated session
  // through the invitation endpoint by presenting only their password and invite code.
  if(preexisting&&mfaEnabled(preexisting.id)){
    const secondFactor=typeof input.recoveryCode==='string'&&input.recoveryCode.length>0
      ?verifyRecoveryCode(preexisting.id,input.recoveryCode)
      :verifyMfa(preexisting.id,input.totp);
    if(!secondFactor)throw new InvitationError('SECOND_FACTOR_REQUIRED');
  }
  return transaction(db=>{
    const invite=db.prepare('SELECT * FROM workspace_invites WHERE token_hash=?').get(codeHash(input.token as string)) as
      {id:string;email:string;workspace_id:string;role:'editor'|'viewer';expires_at:number;redeemed_at:number|null;revoked_at:number|null}|undefined;
    if(!invite||invite.email!==email||invite.expires_at<=Date.now()||invite.redeemed_at||invite.revoked_at)
      throw new InvitationError('INVALID_INVITATION');
    const exists=db.prepare('SELECT id FROM users WHERE email=?').get(email) as {id:string}|undefined;
    let userId:string;
    if(exists){
      // An ex-member can be reinvited without deleting historical audit attribution.
      // Password verification prevents someone with just the invite code from hijacking that identity.
      if(!preexisting||preexisting.id!==exists.id)throw new InvitationError('INVALID_INVITATION');
      const current=(db.prepare('SELECT count(*) AS n FROM memberships WHERE user_id=?').get(exists.id) as {n:number}).n;
      if(current!==0)throw new InvitationError('ACCOUNT_ALREADY_IN_WORKSPACE');
      userId=exists.id;
    }else{
      userId=randomUUID();const salt=randomBytes(24).toString('hex');
      db.prepare('INSERT INTO users(id,email,display_name,password_hash,salt,created_at) VALUES(?,?,?,?,?,?)').run(userId,email,name,passwordHash(password as string,salt),salt,new Date().toISOString());
    }
    db.prepare('INSERT INTO memberships(user_id,workspace_id,role) VALUES(?,?,?)').run(userId,invite.workspace_id,invite.role);
    db.prepare('UPDATE workspace_invites SET redeemed_at=? WHERE id=? AND redeemed_at IS NULL').run(Date.now(),invite.id);
    return userId;
  });
}
export function removeMember(owner:Account,memberId:string){
  if(owner.role!=='owner')throw new ForbiddenError();
  if(owner.id===memberId)throw new InvitationError('CANNOT_REMOVE_OWNER');
  return transaction(db=>{
    const row=db.prepare('SELECT role FROM memberships WHERE user_id=? AND workspace_id=?').get(memberId,owner.workspaceId) as {role:string}|undefined;
    if(!row||row.role==='owner')throw new InvitationError('CANNOT_REMOVE_OWNER');
    const removed=db.prepare('DELETE FROM memberships WHERE workspace_id=? AND user_id=? AND role<>\'owner\'').run(owner.workspaceId,memberId).changes;
    // Membership revoked means all sessions for the user are invalidated.
    db.prepare('DELETE FROM sessions WHERE user_id=?').run(memberId);
    return removed===1;
  });
}
