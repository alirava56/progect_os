export type ProjectStatus = 'building' | 'review' | 'active' | 'archived';
export type TaskStatus = 'todo' | 'doing' | 'blocked' | 'review' | 'done';
export type Priority = 'high' | 'medium' | 'low';
export type ResourceType = 'server' | 'domain' | 'database' | 'service';
export type ResourceStatus = 'registered' | 'review' | 'missing';
export type Environment = 'Production' | 'Staging' | 'Development';
export type Role = 'Owner' | 'Developer' | 'Viewer';
export type DocType = 'Runbook' | 'Technical Design' | 'Decision Record' | 'Checklist' | 'Release Notes';

export interface Project {
  id: string;
  name: string;
  subtitle: string;
  coverTitle: string;
  description: string;
  status: ProjectStatus;
  archivedFrom?: Exclude<ProjectStatus, 'archived'>;
  type: string;
  progress: number;
  next: string;
  art: string;
}
export interface Task {
  id: string;
  title: string;
  projectId: string;
  status: TaskStatus;
  priority: Priority;
  owner: string;
  due: string;
  description: string;
  checklist: { label: string; checked: boolean }[];
  comments: { text: string; date: string }[];
  dependencies: string[];
}
export interface Resource {
  id: string;
  name: string;
  projectId: string;
  type: ResourceType;
  address: string;
  environment: Environment;
  status: ResourceStatus;
  provider: string;
  region?: string;
  os?: string;
  port?: number;
  expires?: string;
  parentId?: string;
  tags: string[];
  linkedProjectIds?: string[];
}
export interface SecretReference {
  id: string;
  name: string;
  projectId: string;
  type: 'SSH Key' | 'API Token' | 'Account' | 'DB Credential';
  vaultProvider: string;
  lastCheckedAt?: string;
  externalRef?: string;
}
export interface Reminder { id: string; title: string; projectId: string; due: string; kind: 'جلسه' | 'تمدید' | 'یادآوری' }
export interface Incident {
  id: string;
  title: string;
  projectId: string;
  priority: Priority;
  source: string;
  date: string;
  state: 'open' | 'acknowledged' | 'snoozed';
  snoozedUntil?: string;
}
export interface Expense {
  id: string;
  title: string;
  projectId: string;
  category: 'زیرساخت' | 'دامنه' | 'پشتیبان‌گیری' | 'اشتراک';
  amount: number;
  date: string;
  status: 'paid' | 'upcoming';
}
export type CurrencyUnit = 'TOMAN' | 'IRR' | 'USD';
export interface RecurringCharge {
  id:string;projectId:string;title:string;provider:string;
  amount:number;currency:CurrencyUnit;period:'monthly'|'quarterly'|'yearly';
  nextDue:string;status:'active'|'paused';linkedResourceId?:string;
}
export interface ContractRecord {
  id:string;projectId:string;title:string;client:string;start:string;end:string;
  amount:number;currency:CurrencyUnit;state:'draft'|'active'|'completed';
}
export interface RevenueEntry {
  id:string;projectId:string;title:string;amount:number;currency:CurrencyUnit;
  date:string;status:'received'|'outstanding';
}
export interface Doc { id: string; title: string; projectId: string; type: DocType; body: string; revision: number; updated: string }
export interface ActivityEvent { id: string; title: string; detail: string; projectId: string; actor: string; source: string; date: string }
export interface Integration { id: string; name: string; description: string; art: string; protocol: string; connected: false }
export interface User { id: string; name: string; email: string; role: Role; projectId: string; state: 'active' | 'invited' }
export interface Preferences {
  workspace: string;
  displayName: string;
  theme: 'dark' | 'dim';
  language: 'fa' | 'fa-latin';
  zone: 'Asia/Tehran' | 'UTC';
  digest: boolean;
  renewal: boolean;
  outage: boolean;
  stale: boolean;
}
export interface DemoData {
  projects: Project[];
  tasks: Task[];
  resources: Resource[];
  secrets: SecretReference[];
  reminders: Reminder[];
  incidents: Incident[];
  expenses: Expense[];
  charges: RecurringCharge[];
  contracts: ContractRecord[];
  revenues: RevenueEntry[];
  docs: Doc[];
  events: ActivityEvent[];
  integrations: Integration[];
  users: User[];
  preferences: Preferences;
}
