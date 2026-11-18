import {randomUUID} from 'node:crypto';
import {transaction,type Account,ForbiddenError} from './db';
import {suspiciousCredential} from './credential-guard';
export class ActivityValidationError extends Error {}
export class ActivityRateLimitError extends Error {}
/** All manual audit entries pass length, membership, credential and quota checks atomically. */
export function appendManualActivity(account:Account,input:unknown){
  if(account.role!=='owner')throw new ForbiddenError();
  if(!input||typeof input!=='object'||Array.isArray(input))throw new ActivityValidationError();
  const {projectId,title,detail}=input as Record<string,unknown>;
  if(typeof projectId!=='string'||typeof title!=='string'||typeof detail!=='string'||
    !title.trim()||!detail.trim()||title.length>120||detail.length>1200||projectId.length>100||
    /[\u0000-\u001f]/.test(projectId)||suspiciousCredential(title)||suspiciousCredential(detail))
    throw new ActivityValidationError();
  const trimmedTitle=title.trim(),trimmedDetail=detail.trim();
  return transaction(db=>{
    if(!db.prepare("SELECT id FROM records WHERE workspace_id=? AND kind='projects' AND id=?").get(account.workspaceId,projectId))
      throw new ActivityValidationError();
    const hourly=new Date(Date.now()-3600000).toISOString();
    const recent=db.prepare("SELECT COUNT(*) AS n FROM audit_events WHERE workspace_id=? AND actor_id=? AND kind='manual' AND created_at>=?")
      .get(account.workspaceId,account.id,hourly) as {n:number};
    if(recent.n>=30)throw new ActivityRateLimitError();
    const id=randomUUID();
    db.prepare('INSERT INTO audit_events(id,workspace_id,actor_id,kind,record_id,action,title,project_id,created_at,actor_snapshot) VALUES(?,?,?,?,?,?,?,?,?,?)')
      .run(id,account.workspaceId,account.id,'manual',projectId,trimmedDetail,trimmedTitle,projectId,new Date().toISOString(),account.displayName);
    return id;
  });
}
