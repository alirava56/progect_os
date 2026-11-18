#!/usr/bin/env node
/** Transactional, idempotent in-app reminder reconciliation with optional Telegram outbox. */
import { DatabaseSync } from 'node:sqlite';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { existsSync } from 'node:fs';
const path=resolve(process.env.PROJECTOS_DB_PATH||'./local-data/projectos.sqlite');
if(!existsSync(path)){console.error('ProjectOS database does not exist. Run account setup first.');process.exit(2);}
const db=new DatabaseSync(path,{timeout:5000});
db.exec('PRAGMA busy_timeout=5000; PRAGMA foreign_keys=ON');
const clock=new Date();
const dateAt=(zone,value=clock)=>new Intl.DateTimeFormat('sv-SE',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit'}).format(value);
const key=(workspace,kind,id,due,source='')=>'auto-'+createHash('sha256').update([workspace,kind,id,due,...(source?[source]:[])].join('|')).digest('hex').slice(0,28);
const telegramEnabled=process.env.PROJECTOS_TELEGRAM_NOTIFICATIONS==='enabled'&&!!process.env.PROJECTOS_TELEGRAM_BOT_TOKEN&&!!process.env.PROJECTOS_TELEGRAM_CHAT_ID;
function normalizeDue(value,zone){
  if(typeof value!=='string')return null;
  if(/^\d{4}-\d{2}-\d{2}$/.test(value))return value;
  if(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{3})?)?Z$/.test(value)){
    const parsed=new Date(value);
    return Number.isNaN(parsed.getTime())?null:dateAt(zone,parsed);
  }
  return null;
}
let generated=0,resumed=0,retired=0,queuedTelegram=0,cancelledTelegram=0,ambiguousLegacy=0;
try{
  const workspaces=db.prepare('SELECT id FROM workspaces').all();
  for(const {id:workspace} of workspaces){
    db.exec('BEGIN IMMEDIATE');
    try{
      // Read state *inside* the write transaction, so edits cannot race with reconciliation.
      const rows=db.prepare('SELECT id,kind,payload FROM records WHERE workspace_id=?').all(workspace);
      const parsed=rows.map(r=>({...r,value:JSON.parse(r.payload)}));
      const preferences=parsed.find(r=>r.kind==='preferences')?.value;
      const zone=preferences?.zone==='UTC'?'UTC':'Asia/Tehran';
      const localToday=dateAt(zone);
      const start=Date.parse(localToday+'T00:00:00Z');
      const candidate=[
        ...parsed.filter(r=>r.kind==='reminders').map(r=>({id:r.id,name:r.value.title,due:r.value.due,kind:r.value.kind,projectId:r.value.projectId,source:'reminders'})),
        ...parsed.filter(r=>r.kind==='charges'&&r.value.nextDue&&r.value.status==='active').map(r=>({id:r.id,name:`اشتراک ${r.value.title}`,due:r.value.nextDue,kind:'تمدید',projectId:r.value.projectId,source:'charges'})),
        ...parsed.filter(r=>r.kind==='resources'&&r.value.expires).map(r=>({id:r.id,name:`تمدید ${r.value.name}`,due:r.value.expires,kind:'تمدید',projectId:r.value.projectId,source:'resources'})),
      ].filter(r=>!(r.kind==='تمدید'&&preferences?.renewal===false));
      // New occurrences always include source identity. Keep old keys when their
      // source can be established, preserving acknowledgement and delivery history.
      const legacyGroups=new Map();
      for(const item of candidate){
        const legacyId=key(workspace,item.kind,item.id,item.due);
        const group=legacyGroups.get(legacyId)??[];
        group.push(item);
        legacyGroups.set(legacyId,group);
      }
      const previousIncidents=new Map(parsed.filter(r=>r.kind==='incidents').map(r=>[r.id,r.value]));
      const outboxRefs=new Map(db.prepare('SELECT id,reminder_id FROM notification_outbox WHERE workspace_id=?').all(workspace).map(row=>[row.id,row.reminder_id]));
      const activeKeys=new Set();
      const withKeys=[];
      for(const [legacyId,group] of legacyGroups){
        const legacy=previousIncidents.get(legacyId);
        const hasLegacy=legacy||outboxRefs.has(legacyId)||outboxRefs.has('tg-'+legacyId);
        const legacyRef=outboxRefs.get(legacyId)??outboxRefs.get('tg-'+legacyId);
        const matching=group.filter(item=>legacyRef===`${item.source}:${item.id}` ||
          legacy?.title===`${item.name} · ${normalizeDue(item.due,zone)}`);
        const owner=matching.length===1?matching[0]:undefined;
        if(hasLegacy&&!owner){
          // An old key without attributable provenance must not be resent or retired.
          activeKeys.add(legacyId);
          for(const item of group)activeKeys.add(key(workspace,item.kind,item.id,item.due,item.source));
          ambiguousLegacy++;
          continue;
        }
        for(const item of group){
          const scopedId=key(workspace,item.kind,item.id,item.due,item.source);
          const isLegacy=item===owner&&!previousIncidents.has(scopedId)&&!outboxRefs.has(scopedId)&&!outboxRefs.has('tg-'+scopedId);
          const alertId=isLegacy?legacyId:scopedId;
          const outboxRef=isLegacy?(legacyRef??item.id):`${item.source}:${item.id}`;
          activeKeys.add(alertId);
          withKeys.push({...item,alertId,outboxRef});
        }
      }
      let changes=0;
      for(const previous of parsed.filter(r=>r.kind==='incidents'&&r.id.startsWith('auto-'))){
        if(activeKeys.has(previous.id))continue;
        db.prepare("DELETE FROM records WHERE workspace_id=? AND kind='incidents' AND id=?").run(workspace,previous.id);
        db.prepare("UPDATE notification_outbox SET state='cancelled',delivered_at=NULL WHERE workspace_id=? AND id IN (?,?) AND state NOT IN ('delivered','cancelled')")
          .run(workspace,previous.id,'tg-'+previous.id);
        retired++;changes++;
      }
      // Disabling Telegram explicitly cancels its still-undelivered queue entries.
      if(!telegramEnabled){
        cancelledTelegram+=db.prepare("UPDATE notification_outbox SET state='cancelled' WHERE workspace_id=? AND channel='telegram' AND state IN ('pending','retrying','sending')")
          .run(workspace).changes;
      }
      for(const r of withKeys){
        const localDue=normalizeDue(r.due,zone);
        if(!localDue)continue;
        const diff=Math.round((Date.parse(localDue+'T00:00:00Z')-start)/86400000);
        const horizon=r.kind==='تمدید'?14:3;
        if(diff < -3 || diff>horizon)continue;
        const id=r.alertId;
        const old=db.prepare("SELECT payload FROM records WHERE workspace_id=? AND kind='incidents' AND id=?").get(workspace,id);
        const previous=old?JSON.parse(old.payload):null;
        if(!previous){
          const incident={id,title:`${r.name} · ${localDue}`,projectId:r.projectId,priority:diff<=3?'high':'medium',source:'زمان‌بند داخلی · ثبت خودکار',date:localToday,state:'open'};
          db.prepare("INSERT OR IGNORE INTO records(workspace_id,kind,id,project_id,payload,updated_at) VALUES(?,?,?,?,?,?)")
            .run(workspace,'incidents',id,r.projectId,JSON.stringify(incident),clock.toISOString());
          generated++;changes++;
        }
        db.prepare("INSERT OR IGNORE INTO notification_outbox(id,workspace_id,reminder_id,scheduled_for,channel,state,created_at,delivered_at) VALUES(?,?,?,?,?,?,?,?)")
          .run(id,workspace,r.outboxRef,r.due,'in_app','available',clock.toISOString(),null);
        if(telegramEnabled && (!previous || previous.state==='open')){
          // The channel may be enabled AFTER the in-app incident already exists.
          const notification='tg-'+id;
          const inserted=db.prepare(`INSERT INTO notification_outbox(id,workspace_id,reminder_id,scheduled_for,channel,state,created_at,delivered_at)
            VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET
            state='pending',delivered_at=NULL WHERE notification_outbox.state='cancelled'`)
            .run(notification,workspace,r.outboxRef,r.due,'telegram','pending',clock.toISOString(),null);
          if(inserted.changes)queuedTelegram++;
        }
      }
      for(const record of parsed.filter(r=>r.kind==='incidents'&&r.value.state==='snoozed'&&r.value.snoozedUntil)){
        if(Date.parse(record.value.snoozedUntil)>clock.getTime())continue;
        const next={...record.value,state:'open'};delete next.snoozedUntil;
        db.prepare("UPDATE records SET payload=?,updated_at=? WHERE workspace_id=? AND kind='incidents' AND id=?")
          .run(JSON.stringify(next),clock.toISOString(),workspace,record.id);
        resumed++;changes++;
      }
      if(changes)db.prepare('UPDATE workspaces SET version=version+1 WHERE id=?').run(workspace);
      db.exec('COMMIT');
    }catch(error){db.exec('ROLLBACK');throw error;}
  }
}finally{db.close();}
console.log(JSON.stringify({generated,resumed,retired,queuedTelegram,cancelledTelegram,ambiguousLegacy,ranAt:clock.toISOString(),channel:'in_app'}));
