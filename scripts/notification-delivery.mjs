import { randomUUID } from 'node:crypto';
import { sql, transaction } from './database.mjs';

const leaseMs = 120_000;
const maxAttempts = 5;

export function configuredChannels(env, send = fetch) {
  const available = {};
  const telegram = env.PROJECTOS_TELEGRAM_BOT_TOKEN;
  const chat = env.PROJECTOS_TELEGRAM_CHAT_ID;
  if (env.PROJECTOS_TELEGRAM_NOTIFICATIONS === 'enabled' && /^\d{5,}:[a-zA-Z0-9_-]{20,}$/.test(telegram ?? '')
    && /^-?\d{4,20}$/.test(chat ?? '')) {
    available.telegram = async ({scheduled_for}) => {
      const response = await send('https://api.telegram.org/bot' + telegram + '/sendMessage', {
        method: 'POST', headers: {'Content-Type':'application/json'}, redirect: 'error',
        body: JSON.stringify({chat_id:chat, text:message(scheduled_for), disable_web_page_preview:true}),
        signal: AbortSignal.timeout(10_000),
      });
      return response.ok && (await response.json()).ok === true;
    };
  }
  const email = value => typeof value === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  if (env.PROJECTOS_EMAIL_NOTIFICATIONS === 'enabled' && env.PROJECTOS_RESEND_API_KEY
    && email(env.PROJECTOS_EMAIL_FROM) && email(env.PROJECTOS_EMAIL_TO)) {
    available.email = async ({id, scheduled_for}) => {
      const response = await send('https://api.resend.com/emails', {
        method: 'POST', redirect: 'error', signal: AbortSignal.timeout(10_000),
        headers: {Authorization:'Bearer ' + env.PROJECTOS_RESEND_API_KEY, 'Content-Type':'application/json', 'Idempotency-Key':id},
        body: JSON.stringify({from:env.PROJECTOS_EMAIL_FROM,to:[env.PROJECTOS_EMAIL_TO],
          subject:'ProjectOS · یادآوری', text:message(scheduled_for)}),
      });
      return response.ok && typeof (await response.json()).id === 'string';
    };
  }
  return available;
}

function message(date) {
  return 'ProjectOS: یک اعلان نیازمند بررسی است. تاریخ: ' + date + '. برای جزئیات وارد فضای کاری شوید.';
}

export async function claimDelivery(workspace, channel, now = Date.now()) {
  return transaction(async db => {
    await db.run(`UPDATE notification_outbox SET state='failed' WHERE workspace_id=? AND channel=? AND state='sending'
      AND id IN (SELECT notification_id FROM delivery_retries WHERE attempts>=? AND claimed_at<=?)`,
    workspace, channel, maxAttempts, now - leaseMs);
    const lock = db.dialect === 'postgres' ? ' FOR UPDATE OF o SKIP LOCKED' : '';
    const job = await db.one(`SELECT o.id,o.scheduled_for,o.channel,COALESCE(r.attempts,0) AS attempts FROM notification_outbox o
      LEFT JOIN delivery_retries r ON r.notification_id=o.id WHERE o.workspace_id=? AND o.channel=?
      AND COALESCE(r.attempts,0)<? AND COALESCE(r.retry_after,0)<=?
      AND (o.state IN ('pending','retrying') OR (o.state='sending' AND r.claimed_at<=?))
      ORDER BY o.created_at,o.id LIMIT 1` + lock, workspace, channel, maxAttempts, now, now - leaseMs);
    if (!job) return;
    const lease = randomUUID(), attempts = job.attempts + 1;
    await db.run(`INSERT INTO delivery_retries(notification_id,attempts,retry_after,claimed_at,lease_token) VALUES(?,?,0,?,?)
      ON CONFLICT(notification_id) DO UPDATE SET attempts=excluded.attempts,retry_after=0,
        claimed_at=excluded.claimed_at,lease_token=excluded.lease_token`, job.id, attempts, now, lease);
    await db.run("UPDATE notification_outbox SET state='sending' WHERE id=?", job.id);
    return {...job, lease, attempts};
  });
}

export async function finishDelivery(job, accepted, now = Date.now()) {
  return transaction(async db => {
    const lock = db.dialect === 'postgres' ? ' FOR UPDATE' : '';
    const current = await db.one('SELECT state FROM notification_outbox WHERE id=?' + lock, job.id);
    if (current?.state !== 'sending') return false;
    const retryAfter = accepted ? 0 : now + Math.min(3600_000, 15_000 * 2 ** job.attempts);
    const changed = await db.run(`UPDATE delivery_retries SET retry_after=?,lease_token=NULL
      WHERE notification_id=? AND lease_token=?`, retryAfter, job.id, job.lease);
    if (!changed) return false;
    const state = accepted ? 'delivered' : job.attempts >= maxAttempts ? 'failed' : 'retrying';
    await db.run('UPDATE notification_outbox SET state=?,delivered_at=? WHERE id=?',
      state, accepted ? new Date(now).toISOString() : null, job.id);
    return true;
  });
}

export async function deliverNotifications(workspace, channels, limit = 30) {
  if (!workspace) throw new Error('An explicit notification workspace is required');
  if (!await sql.one('SELECT id FROM workspaces WHERE id=?', workspace)) throw new Error('Unknown notification workspace');
  let accepted = 0, failed = 0;
  for (const [channel, send] of Object.entries(channels)) {
    for (let i = 0; i < limit; i++) {
      const job = await claimDelivery(workspace, channel);
      if (!job) break;
      let delivered = false;
      try { delivered = await send(job) === true; } catch { /* provider details can contain credentials */ }
      if (await finishDelivery(job, delivered)) {
        if (delivered) accepted++;
        else failed++;
      }
    }
  }
  await sql.run(`INSERT INTO worker_heartbeats(name,checked_at) VALUES('delivery',?)
    ON CONFLICT(name) DO UPDATE SET checked_at=excluded.checked_at`, new Date().toISOString());
  return { accepted, failed, status:'provider-accepted-not-user-read' };
}
