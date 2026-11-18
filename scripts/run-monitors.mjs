#!/usr/bin/env node
/** Explicit opt-in HTTPS health checks. DNS-pinned public IPv4 only; no redirects or user-supplied fetch URL. */
import { DatabaseSync } from 'node:sqlite';
import { lookup } from 'node:dns/promises';
import { request } from 'node:https';
import { isIP } from 'node:net';
import { resolve } from 'node:path';
import { existsSync } from 'node:fs';
const dbPath=resolve(process.env.PROJECTOS_DB_PATH||'./local-data/projectos.sqlite');
const hosts=(process.env.PROJECTOS_MONITOR_HOSTS||'').split(',').map(x=>x.trim().toLowerCase()).filter(Boolean);
if(!hosts.length){console.error('Monitoring disabled. Explicitly set PROJECTOS_MONITOR_HOSTS to comma-separated public HTTPS hostnames.');process.exit(2);}
if(!existsSync(dbPath)){console.error('Database not found');process.exit(2);}
function isPublicIPv4(ip){
  if(isIP(ip)!==4)return false;
  const [a,b,c]=ip.split('.').map(Number);
  return !(a===0||a===10||a===127||a>=224||(a===100&&b>=64&&b<=127)||
    (a===169&&b===254)||(a===172&&b>=16&&b<=31)||(a===192&&(b===168||b===0||b===2))||
    (a===198&&(b===18||b===19||b===51&&c===100))||
    (a===203&&b===0&&c===113)||(a===192&&b===88&&c===99)||a===255);
}
function validHost(host){return host.length<=253&&!host.endsWith('.')&&!host.includes('..')&&!isIP(host)&&
  !/(^|\.)(localhost|local|internal|test|invalid|example)$/.test(host)&&
  /^[a-z0-9]+(?:[a-z0-9.-]*[a-z0-9])?$/.test(host)&&host.includes('.');}
export async function probeHttps(url){
  const target=new URL(url);
  if(target.protocol!=='https:'||target.username||target.password||target.port||target.hash||target.search||target.pathname!=='/'||!validHost(target.hostname)||!hosts.includes(target.hostname))throw Error('Monitor target not explicitly permitted');
  const records=await lookup(target.hostname,{family:4,all:true,verbatim:true});
  if(!records.length||records.some(r=>!isPublicIPv4(r.address)))throw Error('Public IPv4 DNS verification failed');
  const address=records[0].address;
  const begun=Date.now();
  return await new Promise((success,reject)=>{
    // Pin DNS lookup to the validated numeric address; TLS verifies the hostname.
    const req=request(target,{method:'HEAD',timeout:7000,signal:AbortSignal.timeout(10000),maxHeaderSize:8192,headers:{'User-Agent':'ProjectOS-Monitor/1.0'},
      lookup:(_host,_opts,callback)=>callback(null,address,4)},res=>{
      res.resume();
      res.on('end',()=>success({status:res.statusCode||0,latencyMs:Date.now()-begun,healthy:(res.statusCode||0)>=200&&(res.statusCode||0)<400}));
    });
    req.on('timeout',()=>req.destroy(Error('Health check timed out')));
    req.on('error',reject);req.end();
  });
}
const db=new DatabaseSync(dbPath,{timeout:5000});
try{
  db.exec(`PRAGMA busy_timeout=5000;CREATE TABLE IF NOT EXISTS monitor_observations(
    id INTEGER PRIMARY KEY AUTOINCREMENT, workspace_id TEXT NOT NULL, resource_id TEXT NOT NULL,
    checked_at TEXT NOT NULL, state TEXT NOT NULL, status_code INTEGER, latency_ms INTEGER,
    diagnostic TEXT NOT NULL, UNIQUE(workspace_id,resource_id,checked_at));
    CREATE INDEX IF NOT EXISTS idx_observation_latest ON monitor_observations(workspace_id,resource_id,checked_at DESC);`);
  let tested=0;
  const resources=db.prepare("SELECT workspace_id,id,payload FROM records WHERE kind='resources'").all();
  for(const row of resources){
    if(tested>=100)break;
    let resource;try{resource=JSON.parse(row.payload);}catch{continue;}
    if(typeof resource.address!=='string')continue;
    let host;try{host=new URL(resource.address).hostname.toLowerCase();}catch{continue;}
    if(!hosts.includes(host))continue;
    tested++;
    let observation;
    try{observation=await probeHttps(resource.address);}
    catch{observation={status:null,latencyMs:null,healthy:null};}
    db.prepare('INSERT INTO monitor_observations(workspace_id,resource_id,checked_at,state,status_code,latency_ms,diagnostic) VALUES(?,?,?,?,?,?,?)')
      .run(row.workspace_id,row.id,new Date().toISOString(),observation.healthy===null?'unknown':observation.healthy?'healthy':'unhealthy',observation.status,observation.latencyMs,observation.healthy===null?'HTTPS could not be verified':observation.healthy?'HTTPS check passed':'HTTPS check failed');
  }
  console.log(JSON.stringify({tested,loggedAt:new Date().toISOString(),mode:'explicit-host-allowlist'}));
}finally{db.close();}
