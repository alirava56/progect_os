import type { ProjectStatus, ResourceStatus, ResourceType, Priority, TaskStatus, Incident } from './types';

export type Tone = 'violet' | 'good' | 'warn' | 'bad' | 'neutral';
export const projectStatuses: Record<ProjectStatus, string> = { building: 'در حال توسعه', review: 'در حال بررسی', active: 'فعال', archived: 'بایگانی‌شده' };
export const projectTones: Record<ProjectStatus, Tone> = { building: 'good', review: 'warn', active: 'good', archived: 'neutral' };
export const taskStatuses: Record<TaskStatus, string> = { todo: 'برای انجام', doing: 'در حال انجام', blocked: 'مسدودشده', review: 'منتظر تأیید', done: 'تکمیل‌شده' };
export const taskTones: Record<TaskStatus, Tone> = { todo: 'warn', doing: 'violet', blocked: 'bad', review: 'warn', done: 'good' };
export const priorities: Record<Priority, string> = { high: 'بالا', medium: 'متوسط', low: 'کم' };
export const priorityTones: Record<Priority, Tone> = { high: 'bad', medium: 'warn', low: 'neutral' };
export const resourceTypes: Record<ResourceType, string> = { server: 'سرور', domain: 'دامنه', database: 'دیتابیس', service: 'سرویس' };
export const resourceStatuses: Record<ResourceStatus, string> = { registered: 'ثبت شده', review: 'نیازمند بررسی', missing: 'ناقص' };
export const resourceTones: Record<ResourceStatus, Tone> = { registered: 'good', review: 'warn', missing: 'warn' };
export const incidentStates: Record<Incident['state'], string> = {
  open:'باز', acknowledged:'رسیدگی‌شده', snoozed:'به‌تعویق‌افتاده', resolved:'حل‌شده', dismissed:'کنار گذاشته‌شده',
};
export const roles = { Owner: 'مدیر', Developer: 'توسعه‌دهنده', Viewer: 'ناظر' };
export const choices = (labels: Record<string, string>) => Object.entries(labels).map(([value, label]) => ({ value, label }));
