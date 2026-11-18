import type { DemoData } from '../types';
import { emptyData } from '../empty-data';
import { suspiciousInRecord } from './credential-guard';
import {vaultLink} from '../vault-link';

type Rule = {type:'string'|'number'|'boolean'|'strings'|'checklist'|'comments'; max?:number; values?:readonly string[]; optional?:boolean};
const s=(max=200,optional=false,values?:readonly string[]):Rule=>({type:'string',max,optional,values});
const n=(max=1e12,optional=false):Rule=>({type:'number',max,optional});
const str=(max=30):Rule=>({type:'strings',max});
const ruleSets={
  projects:{id:s(100),name:s(100),subtitle:s(150),coverTitle:s(150),description:s(4000),status:s(30,false,['building','review','active','archived']),archivedFrom:s(30,true,['building','review','active']),type:s(70),progress:n(100),next:s(400),art:s(100)},
  tasks:{id:s(100),title:s(200),projectId:s(100),status:s(20,false,['todo','doing','blocked','review','done']),priority:s(20,false,['low','medium','high']),owner:s(100),due:s(32),description:s(10000),checklist:{type:'checklist',max:200},comments:{type:'comments',max:500},dependencies:str(80)},
  resources:{id:s(100),name:s(160),projectId:s(100),type:s(24,false,['server','domain','database','service']),address:s(350),environment:s(50,false,['Production','Staging','Development']),status:s(25,false,['registered','review','missing']),provider:s(160),region:s(120,true),os:s(120,true),port:n(65535,true),expires:s(32,true),parentId:s(100,true),tags:str(20),linkedProjectIds:str(100)},
  secrets:{id:s(100),name:s(160),projectId:s(100),type:s(30,false,['SSH Key','API Token','Account','DB Credential']),vaultProvider:s(160),lastCheckedAt:s(32,true),externalRef:s(500,true)},
  reminders:{id:s(100),title:s(180),projectId:s(100),due:s(32),kind:s(20,false,['جلسه','تمدید','یادآوری'])},
  incidents:{id:s(100),title:s(200),projectId:s(100),priority:s(20,false,['high','medium','low']),source:s(140),date:s(32),state:s(20,false,['open','acknowledged','snoozed']),snoozedUntil:s(32,true)},
  expenses:{id:s(100),title:s(160),projectId:s(100),category:s(30,false,['زیرساخت','دامنه','پشتیبان‌گیری','اشتراک']),amount:n(1e12),date:s(32),status:s(20,false,['paid','upcoming'])},
  charges:{id:s(100),projectId:s(100),title:s(160),provider:s(120),amount:n(1e12),currency:s(10,false,['TOMAN','IRR','USD']),period:s(20,false,['monthly','quarterly','yearly']),nextDue:s(32),status:s(15,false,['active','paused']),linkedResourceId:s(100,true)},
  contracts:{id:s(100),projectId:s(100),title:s(160),client:s(160),start:s(32),end:s(32),amount:n(1e12),currency:s(10,false,['TOMAN','IRR','USD']),state:s(15,false,['draft','active','completed'])},
  revenues:{id:s(100),projectId:s(100),title:s(160),amount:n(1e12),currency:s(10,false,['TOMAN','IRR','USD']),date:s(32),status:s(20,false,['received','outstanding'])},
  docs:{id:s(100),title:s(180),projectId:s(100),type:s(30,false,['Runbook','Technical Design','Decision Record','Checklist','Release Notes']),body:s(100000),revision:n(1e6),updated:s(32)},
} as const;
type Collection=keyof typeof ruleSets;
export type CanonicalState=Pick<DemoData,Collection|'preferences'>;
export class ValidationError extends Error {constructor(public reason:string){super(reason);}}
function bad(message:string):never { throw new ValidationError(message); }
function plain(value:unknown):value is Record<string,unknown>{return value!==null&&typeof value==='object'&&!Array.isArray(value)&&Object.getPrototypeOf(value)===Object.prototype;}
function text(value:unknown,max:number,optional:boolean=false,values?:readonly string[]) {
  if(value===undefined && optional)return undefined;
  if(typeof value!=='string'||value.length>max||/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/.test(value))bad('Invalid text field');
  if(values&&!values.includes(value))bad('Invalid enum value');
  return value;
}
function parseField(value:unknown,rule:Rule) {
  if(value===undefined&&rule.optional)return undefined;
  if(rule.type==='string')return text(value,rule.max??200,rule.optional,rule.values);
  if(rule.type==='number') {
    if(typeof value!=='number'||!Number.isFinite(value)||value<0||value>(rule.max??1e12))bad('Invalid number');
    return value;
  }
  if(rule.type==='boolean'){
    if(typeof value!=='boolean')bad('Invalid boolean');
    return value;
  }
  if(!Array.isArray(value)||value.length>(rule.max??100))bad('Invalid array');
  if(rule.type==='strings'){
    if(value.some(v=>typeof v!=='string'||v.length>100))bad('Invalid array member');
    return [...new Set(value)];
  }
  if(rule.type==='checklist')return value.map(v=>{
    if(!plain(v)||Object.keys(v).some(k=>!['label','checked'].includes(k))||typeof v.checked!=='boolean')bad('Invalid checklist');
    return {label:text(v.label,500),checked:v.checked};
  });
  if(rule.type==='comments')return value.map(v=>{
    if(!plain(v)||Object.keys(v).some(k=>!['text','date'].includes(k)))bad('Invalid comment');
    const date=text(v.date,32);
    checkDate(date);
    return {text:text(v.text,2000),date};
  });
  return bad('Unrecognized field');
}
function parseCollection(value:unknown,kind:Collection,limit:number) {
  if(!Array.isArray(value)||value.length>limit)bad(`Invalid ${kind} collection`);
  const keys=ruleSets[kind] as Record<string,Rule>;
  const ids=new Set<string>();
  return value.map(item=>{
    if(!plain(item))bad('Invalid record');
    if(Object.keys(item).some(k=>!(k in keys)))bad(`Unrecognized field in ${kind}`);
    const clean:Record<string,unknown>={};
    for(const [key,rule] of Object.entries(keys)){
      const field=parseField(item[key],rule);
      if(field!==undefined)clean[key]=field;
    }
    const id=clean.id as string;
    if(!id||ids.has(id))bad('Duplicate or empty record id');
    if(suspiciousInRecord(clean))bad('Possible credential in unencrypted workspace field. Store it in your external vault instead.');
    ids.add(id);
    return clean;
  });
}
function checkDate(date:unknown) {
  if(typeof date!=='string')bad('Date must be YYYY-MM-DD or UTC ISO string');
  const match=/^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{3}))?)?Z)?$/.exec(date);
  if(!match)bad('Date must be YYYY-MM-DD or UTC ISO string');
  const [,year,month,day,hour,minute,second,millis]=match;
  const y=Number(year),m=Number(month),d=Number(day);
  const leap=y%4===0&&(y%100!==0||y%400===0);
  const days=[31,leap?29:28,31,30,31,30,31,31,30,31,30,31];
  if(y<1||m<1||m>12||d<1||d>days[m-1])bad('Invalid calendar date');
  if(hour!==undefined&&(Number(hour)>23||Number(minute)>59||Number(second??0)>59||Number(millis??0)>999))bad('Invalid UTC time');
}
function checkAddress(address:string) {
  // Metadata only — no outbound network request is performed by ProjectOS.
  if(!address||address.length>350||/\s/.test(address)||/[<>"'\\]/.test(address))bad('Invalid resource address');
  if(/^[a-z]+:\/\//i.test(address)){
    let url:URL;try{url=new URL(address);}catch{bad('Invalid resource URL');}
    if(!['http:','https:'].includes(url.protocol)||url.username||url.password)bad('Unsupported URL');
  }else if(address.includes('@')||address.includes('://'))bad('Credential-containing address is prohibited');
}
function preferences(value:unknown):DemoData['preferences']{
  if(!plain(value))bad('Invalid preferences');
  const defaults=emptyData.preferences;
  const allowed=Object.keys(defaults);
  if(Object.keys(value).some(k=>!allowed.includes(k)))bad('Unexpected preference');
  return {
    workspace:text(value.workspace,80) as string,displayName:text(value.displayName,80) as string,
    theme:text(value.theme,10,false,['dark','dim']) as 'dark'|'dim',
    language:text(value.language,15,false,['fa','fa-latin']) as 'fa'|'fa-latin',
    zone:text(value.zone,20,false,['Asia/Tehran','UTC']) as 'Asia/Tehran'|'UTC',
    digest:parseField(value.digest,{type:'boolean'}) as boolean,
    renewal:parseField(value.renewal,{type:'boolean'}) as boolean,
    outage:parseField(value.outage,{type:'boolean'}) as boolean,
    stale:parseField(value.stale,{type:'boolean'}) as boolean,
  };
}
export function parseState(value:unknown):CanonicalState {
  if(!plain(value))bad('State must be an object');
  const keys=[...Object.keys(ruleSets),'preferences','events','users','integrations'];
  if(Object.keys(value).some(k=>!keys.includes(k)))bad('Unexpected top-level property');
  const state={
    projects:parseCollection(value.projects,'projects',1000),
    tasks:parseCollection(value.tasks,'tasks',10000),
    resources:parseCollection(value.resources,'resources',10000),
    secrets:parseCollection(value.secrets,'secrets',2000),
    reminders:parseCollection(value.reminders,'reminders',10000),
    incidents:parseCollection(value.incidents,'incidents',10000),
    expenses:parseCollection(value.expenses,'expenses',20000),
    charges:parseCollection(value.charges,'charges',5000),
    contracts:parseCollection(value.contracts,'contracts',5000),
    revenues:parseCollection(value.revenues,'revenues',10000),
    docs:parseCollection(value.docs,'docs',5000),
    preferences:preferences(value.preferences),
  } as unknown as CanonicalState;
  const projects=new Set(state.projects.map(p=>p.id));
  const tasks=new Set(state.tasks.map(t=>t.id));
  const resources=new Set(state.resources.map(r=>r.id));
  for(const kind of ['tasks','resources','secrets','reminders','incidents','expenses','charges','contracts','revenues','docs'] as const)
    for(const record of state[kind])if(!projects.has(record.projectId))bad(`Unknown project in ${kind}`);
  for(const r of state.resources){
    checkAddress(r.address);
    if(r.parentId&&(!resources.has(r.parentId)||r.parentId===r.id))bad('Invalid resource parent');
    if(r.expires)checkDate(r.expires);
    if(r.linkedProjectIds?.some(id=>!projects.has(id)))bad('Invalid shared resource project');
    if(r.port!==undefined&&(!Number.isInteger(r.port)||r.port<1))bad('Invalid resource port');
  }
  const parentById=new Map(state.resources.map(r=>[r.id,r.parentId]));
  const visitedResources=new Set<string>(),visitingResources=new Set<string>();
  const visitResource=(id:string)=>{
    if(visitingResources.has(id))bad('Resource parent cycle');
    if(visitedResources.has(id))return;
    visitingResources.add(id);
    const parent=parentById.get(id);if(parent)visitResource(parent);
    visitingResources.delete(id);visitedResources.add(id);
  };
  for(const id of resources)visitResource(id);
  const dependencies=new Map(state.tasks.map(t=>[t.id,t.dependencies]));
  for(const task of state.tasks){checkDate(task.due);if(task.dependencies.some(id=>!tasks.has(id)||id===task.id))bad('Invalid task dependency');}
  const seen=new Set<string>(),visiting=new Set<string>();
  const visit=(id:string)=>{if(visiting.has(id))bad('Task dependency cycle');if(seen.has(id))return;visiting.add(id);for(const d of dependencies.get(id)??[])visit(d);visiting.delete(id);seen.add(id);};
  for(const id of tasks)visit(id);
  for(const r of state.reminders)checkDate(r.due);
  for(const r of state.incidents){checkDate(r.date);if(r.snoozedUntil)checkDate(r.snoozedUntil);}
  for(const e of state.expenses){checkDate(e.date);if(!Number.isSafeInteger(e.amount))bad('Expense must use integer amounts (legacy TOMAN unit)');}
  for(const d of state.docs)checkDate(d.updated);
  for(const c of state.charges){
    checkDate(c.nextDue);
    if(c.linkedResourceId&&!resources.has(c.linkedResourceId))bad('Invalid charge resource reference');
    if(!Number.isSafeInteger(c.amount))bad('Monetary amounts must be integer minor units');
  }
  for(const c of state.contracts){
    checkDate(c.start);
    checkDate(c.end);
    if(Date.parse(c.end)<Date.parse(c.start))bad('Contract end before start');
    if(!Number.isSafeInteger(c.amount))bad('Monetary amounts must be integers');
  }
  for(const r of state.revenues){checkDate(r.date);if(!Number.isSafeInteger(r.amount))bad('Monetary amounts must be integers');}
  for(const s of state.secrets){
    if(s.lastCheckedAt)checkDate(s.lastCheckedAt);
    if(s.externalRef&&!vaultLink(s.externalRef))bad('External vault link must belong to an approved vault hostname (HTTPS)');
  }
  return state;
}
