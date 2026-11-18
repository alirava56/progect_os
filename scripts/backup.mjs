#!/usr/bin/env node
import { DatabaseSync, backup } from 'node:sqlite';
import { resolve,dirname } from 'node:path';
import { mkdirSync,chmodSync,existsSync } from 'node:fs';
if(process.env.PROJECTOS_ALLOW_PLAINTEXT_BACKUP!=='test-only'){console.error('Plaintext backup disabled. Use npm run backup:encrypted instead.');process.exit(2);}
const source=resolve(process.env.PROJECTOS_DB_PATH||'./local-data/projectos.sqlite');
if(!existsSync(source)){console.error('Database not found');process.exit(2);}
const output=resolve(process.argv[2]||`./backups/projectos-${new Date().toISOString().replace(/[:.]/g,'-')}.sqlite`);
if(output===source){console.error('Backup destination must differ from source');process.exit(2);}
mkdirSync(dirname(output),{recursive:true,mode:0o700});
const db=new DatabaseSync(source,{readOnly:true});
try{
  await backup(db,output);
  try{chmodSync(output,0o600);}catch{}
  console.log(`Backup created: ${output}\nRemember: this is an unencrypted database backup; protect it or encrypt it before transferring.`);
}finally{db.close();}
