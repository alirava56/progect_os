#!/usr/bin/env node
/** Streaming AES-256-GCM encrypted SQLite snapshot (v1 compatible); no full-DB RAM buffer. */
import { DatabaseSync, backup } from 'node:sqlite';
import { randomBytes, scryptSync, createCipheriv } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, rmSync, createReadStream, openSync, writeSync, closeSync, fsyncSync, unlinkSync, chmodSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
const source=resolve(process.env.PROJECTOS_DB_PATH||'./local-data/projectos.sqlite');
const target=resolve(process.argv[2]||'./backups/projectos-'+new Date().toISOString().replace(/[:.]/g,'-')+'.posbak');
const passphrase=process.env.PROJECTOS_BACKUP_PASSPHRASE;
if(!passphrase||passphrase.length<20){console.error('Set PROJECTOS_BACKUP_PASSPHRASE with >=20 characters in environment.');process.exit(2);}
if(!existsSync(source)||target===source||!target.endsWith('.posbak')){console.error('Missing database or invalid output path (.posbak required).');process.exit(2);}
function writeAll(fd,buffer,offset=null){
  let done=0;
  while(done<buffer.length){
    const wrote=writeSync(fd,buffer,done,buffer.length-done,offset===null?null:offset+done);
    if(wrote===0)throw Error('Could not write encrypted backup');
    done+=wrote;
  }
}
const temp=mkdtempSync(join(tmpdir(),'projectos-encrypted-backup-'));
let fd=null,created=false;
try{
  const temporary=join(temp,'snapshot.sqlite');
  const db=new DatabaseSync(source,{readOnly:true});
  try{await backup(db,temporary);}finally{db.close();}
  const snapshot=new DatabaseSync(temporary,{readOnly:true});
  try{
    if(Object.values(snapshot.prepare('PRAGMA integrity_check').get())[0]!=='ok')throw Error('Backup integrity invalid');
    if(snapshot.prepare('PRAGMA foreign_key_check').all().length)throw Error('Backup foreign key integrity invalid');
  }finally{snapshot.close();}
  const salt=randomBytes(24),iv=randomBytes(12),key=scryptSync(passphrase,salt,32,{N:32768,r:8,p:1,maxmem:128*1024*1024});
  const cipher=createCipheriv('aes-256-gcm',key,iv);
  const header=Buffer.from('PROJECTOS-BACKUP-v1\n');
  cipher.setAAD(header);
  mkdirSync(dirname(target),{recursive:true,mode:0o700});
  fd=openSync(target,'wx',0o600);created=true;
  // Reserve authentication-tag bytes, then backfill them at a fixed offset after encryption.
  writeAll(fd,Buffer.concat([header,salt,iv,Buffer.alloc(16)]));
  for await(const chunk of createReadStream(temporary,{highWaterMark:256*1024}))writeAll(fd,cipher.update(chunk));
  writeAll(fd,cipher.final());
  writeAll(fd,cipher.getAuthTag(),header.length+24+12);
  fsyncSync(fd);closeSync(fd);fd=null;
  try{chmodSync(target,0o600);}catch{}
  console.log(JSON.stringify({ok:true,encrypted:true,streaming:true,format:'PROJECTOS-BACKUP-v1',target}));
}catch(error){
  if(fd!==null){try{closeSync(fd);}catch{}}
  if(created){try{unlinkSync(target);}catch{}}
  throw error;
}finally{rmSync(temp,{recursive:true,force:true});}
