#!/usr/bin/env node
import { closeDatabase } from './database.mjs';
import { configuredChannels } from './notification-delivery.mjs';
import { reconcileReminders } from './reminder-scheduler.mjs';

try {
  const configured = process.env.PROJECTOS_REMINDER_OFFSETS;
  const offsets = configured === undefined ? undefined : [...new Set(configured.split(',').map(Number))];
  if (offsets?.some(offset => !Number.isSafeInteger(offset) || offset < 0 || offset > 60)) throw new Error('Invalid reminder offsets');
  console.log(JSON.stringify(await reconcileReminders({
    channels: Object.keys(configuredChannels(process.env)), offsets,
    notificationWorkspace: process.env.PROJECTOS_NOTIFICATION_WORKSPACE,
  })));
} catch (error) {
  console.error('Reminder worker failed:', error.code ?? error.name);
  process.exitCode = 1;
} finally {
  await closeDatabase();
}
