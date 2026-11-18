#!/usr/bin/env node
import { DatabaseSync } from 'node:sqlite';
import { resolve } from 'node:path';
import { existsSync } from 'node:fs';
const file=process.argv[2];
if(!file||!existsSync(resolve(file))){console.error('Usage: npm run verify:backup -- <path-to-backup.sqlite>');process.exit(2);}
const db=new DatabaseSync(resolve(file),{readOnly:true});
try{
  const result=db.prepare('PRAGMA integrity_check').get();
  const integrity=Object.values(result)[0];
  if(integrity!=='ok')throw Error('integrity_check failed: '+integrity);
  const tables=db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(x=>x.name);
  const essential=['users','workspaces','memberships','sessions','records','audit_events'];
  if(essential.some(x=>!tables.includes(x)))throw Error('Missing essential tables');
  const counts=Object.fromEntries(essential.map(table=>[table,Number(db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get().n)]));
  console.log(JSON.stringify({integrity,tables:tables.length,counts,verifiedAt:new Date().toISOString()},null,2));
  console.log('This verifies backup file integrity, NOT a full staging restore, key recovery, or application behavior.');
}finally{db.close();}
