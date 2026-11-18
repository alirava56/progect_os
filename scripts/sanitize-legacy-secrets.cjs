#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports -- offline Node.js remediation script compiles the TypeScript guard using installed TypeScript */
/** Offline remediation of accidentally stored credentials. Only pattern-based, NOT complete detection. */
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process');
const {DatabaseSync}=require('node:sqlite');
const ts=require('typescript');
require.extensions['.ts']=(module,file)=>{
  const source=fs.readFileSync(file,'utf8');
  module._compile(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,file);
};
const {suspiciousInRecord,redactStoredValue,redactCredentials}=require('../src/lib/server/credential-guard.ts');
const source=path.resolve(process.env.PROJECTOS_DB_PATH||'./local-data/projectos.sqlite');
const apply=process.argv.includes('--apply');
if(!fs.existsSync(source)){console.error('Database not found.');process.exit(2);}
if(apply&&(!process.env.PROJECTOS_BACKUP_PASSPHRASE||process.env.PROJECTOS_BACKUP_PASSPHRASE.length<20)){
  console.error('--apply requires PROJECTOS_BACKUP_PASSPHRASE (>=20 characters) for mandatory encrypted safety backup.');process.exit(2);
}
const db=new DatabaseSync(source,{timeout:5000});
try{
  const rows=db.prepare('SELECT workspace_id,kind,id,payload FROM records').all();
  const changed=[];
  for(const row of rows){
    let data;try{data=JSON.parse(row.payload);}catch{throw Error(`Malformed JSON in record ${row.kind}:${row.id}`);}
    if(suspiciousInRecord(data))changed.push({...row,payload:JSON.stringify(redactStoredValue(data))});
  }
  const versions=db.prepare('SELECT workspace_id,document_id,revision,payload FROM document_versions').all();
  const sensitiveVersions=versions.filter(row=>{
    try{return suspiciousInRecord(JSON.parse(row.payload));}catch{return true;}
  });
  const audit=db.prepare('SELECT id,title,actor_snapshot FROM audit_events').all();
  const sensitiveAudits=audit.filter(row=>[row.title,row.actor_snapshot].some(v=>typeof v==='string'&&v!==redactCredentials(v)));
  const summary={mode:apply?'apply':'dry-run',potentiallySensitiveRecords:changed.length,
    documentVersions:sensitiveVersions.length,auditTitles:sensitiveAudits.length,
    affectedRecordIds:changed.map(c=>({kind:c.kind,id:c.id}))};
  if(!apply){console.log(JSON.stringify(summary,null,2));process.exit(0);}
  const directory=path.resolve('./backups');fs.mkdirSync(directory,{recursive:true,mode:0o700});
  const backup=path.join(directory,'before-redaction-'+new Date().toISOString().replace(/[:.]/g,'-')+'.posbak');
  const encrypted=cp.spawnSync(process.execPath,[path.resolve(__dirname,'encrypted-backup.mjs'),backup],{env:process.env,encoding:'utf8'});
  if(encrypted.status!==0)throw Error('Encrypted pre-sanitization backup failed. Database not modified.');
  const verified=cp.spawnSync(process.execPath,[path.resolve(__dirname,'verify-encrypted-backup.mjs'),backup],{env:process.env,encoding:'utf8'});
  if(verified.status!==0)throw Error('Encrypted backup verification failed. Database not modified.');
  db.exec('BEGIN IMMEDIATE');
  try{
    const update=db.prepare('UPDATE records SET payload=?,updated_at=? WHERE workspace_id=? AND kind=? AND id=?');
    for(const row of changed)update.run(row.payload,new Date().toISOString(),row.workspace_id,row.kind,row.id);
    const updateVersion=db.prepare('UPDATE document_versions SET payload=? WHERE workspace_id=? AND document_id=? AND revision=?');
    for(const row of sensitiveVersions)updateVersion.run(JSON.stringify(redactStoredValue(JSON.parse(row.payload))),row.workspace_id,row.document_id,row.revision);
    const updateAudit=db.prepare('UPDATE audit_events SET title=?,actor_snapshot=? WHERE id=?');
    for(const row of sensitiveAudits)updateAudit.run(redactCredentials(row.title),redactCredentials(row.actor_snapshot),row.id);
    for(const workspaceId of new Set(changed.map(row=>row.workspace_id)))
      db.prepare('UPDATE workspaces SET version=version+1 WHERE id=?').run(workspaceId);
    db.exec('COMMIT');
  }catch(e){db.exec('ROLLBACK');throw e;}
  console.log(JSON.stringify({...summary,encryptedBackupCreated:true,warning:'Rotate any exposed real credentials; prior backups still need secure retention or disposal.'},null,2));
}catch(error){console.error(error instanceof Error?error.message:'Sanitization failed');process.exitCode=1;}
finally{db.close();}
