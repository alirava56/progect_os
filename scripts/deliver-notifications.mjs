#!/usr/bin/env node
/** Explicit opt-in Telegram notification delivery, persisted retry state and atomic claims. */
import {DatabaseSync} from 'node:sqlite';
import {resolve} from 'node:path';
import {existsSync} from 'node:fs';
const source=resolve(process.env.PROJECTOS_DB_PATH||'./local-data/projectos.sqlite');
const token=process.env.PROJECTOS_TELEGRAM_BOT_TOKEN;
const chat=process.env.PROJECTOS_TELEGRAM_CHAT_ID;
if(process.env.PROJECTOS_TELEGRAM_NOTIFICATIONS!=='enabled'||!token||!chat){
  console.error('Telegram notifications not explicitly configured. No messages sent.');process.exit(2);
}
if(!/^\d{5,}:[a-zA-Z0-9_-]{20,}$/.test(token)||!/^(-?[0-9]{4,20})$/.test(chat)){
  console.error('Invalid Telegram credentials format');process.exit(2);
}
if(!existsSync(source)){console.error('Database not found');process.exit(2);}
const db=new DatabaseSync(source,{timeout:5000});
try{
  db.exec(`PRAGMA busy_timeout=5000;
    CREATE TABLE IF NOT EXISTS delivery_retries(
      notification_id TEXT PRIMARY KEY, attempts INTEGER NOT NULL DEFAULT 0,
      retry_after INTEGER NOT NULL DEFAULT 0, claimed_at INTEGER NOT NULL DEFAULT 0);`);
  let sent=0,failed=0;
  const jobs=db.prepare("SELECT id,workspace_id,reminder_id,scheduled_for FROM notification_outbox WHERE channel='telegram' AND state IN ('pending','retrying','sending') ORDER BY created_at LIMIT 30").all();
  for(const job of jobs){
    const now=Date.now();
    db.exec('BEGIN IMMEDIATE');
    let claimed=false;
    try{
      const retry=db.prepare('SELECT attempts,retry_after,claimed_at FROM delivery_retries WHERE notification_id=?').get(job.id);
      const row=db.prepare('SELECT state FROM notification_outbox WHERE id=?').get(job.id);
      if(row&&(row.state==='pending'||row.state==='retrying'||(row.state==='sending'&&retry&&retry.claimed_at<now-120000))&&(!retry||retry.retry_after<=now)&&(!retry||retry.attempts<5)){
        db.prepare('INSERT INTO delivery_retries(notification_id,attempts,retry_after,claimed_at) VALUES(?,?,?,?) ON CONFLICT(notification_id) DO UPDATE SET claimed_at=excluded.claimed_at').run(job.id,0,0,now);
        db.prepare("UPDATE notification_outbox SET state='sending' WHERE id=?").run(job.id);claimed=true;
      }
      db.exec('COMMIT');
    }catch(e){db.exec('ROLLBACK');throw e;}
    if(!claimed)continue;
    // Fixed information-minimal notification; neither free-text documents nor secrets are sent.
    const text=`ProjectOS: یک موعد نیازمند بررسی است. تاریخ: ${job.scheduled_for}. برای جزئیات وارد داشبورد امن شوید.`;
    let delivered=false;
    try{
      const response=await fetch(`https://api.telegram.org/bot${token}/sendMessage`,{
        method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({chat_id:chat,text,disable_web_page_preview:true}),
        signal:AbortSignal.timeout(10000)
      });
      delivered=response.ok;
      // Provider response intentionally not logged to avoid leaking metadata.
    }catch{}
    db.exec('BEGIN IMMEDIATE');
    try{
      const state=db.prepare('SELECT state FROM notification_outbox WHERE id=?').get(job.id)?.state;
      if(state==='sending'){
        if(delivered){
          db.prepare("UPDATE notification_outbox SET state='delivered',delivered_at=? WHERE id=?").run(new Date().toISOString(),job.id);
          sent++;
        }else{
          const old=db.prepare('SELECT attempts FROM delivery_retries WHERE notification_id=?').get(job.id);
          const attempts=(old?.attempts??0)+1;
          db.prepare('UPDATE delivery_retries SET attempts=?,retry_after=? WHERE notification_id=?').run(attempts,Date.now()+Math.min(3600000,15000*2**attempts),job.id);
          db.prepare("UPDATE notification_outbox SET state=? WHERE id=?").run(attempts>=5?'failed':'retrying',job.id);
          failed++;
        }
      }
      db.exec('COMMIT');
    }catch(e){db.exec('ROLLBACK');throw e;}
  }
  console.log(JSON.stringify({sent,failed,channel:'telegram',status:'provider-accepted-not-user-read'}));
}finally{db.close();}
