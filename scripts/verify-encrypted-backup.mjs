#!/usr/bin/env node
/** Streaming authenticated decryption + isolated integrity and restore validation. */
import { DatabaseSync } from 'node:sqlite';
import { scryptSync, createDecipheriv } from 'node:crypto';
import { createReadStream, openSync, readSync, writeSync, closeSync, statSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join,resolve } from 'node:path';
const file=process.argv[2],passphrase=process.env.PROJECTOS_BACKUP_PASSPHRASE;
if(!file||!passphrase||passphrase.length<20){console.error('Usage: PROJECTOS_BACKUP_PASSPHRASE=<secret> npm run verify:encrypted-backup -- <file.posbak>');process.exit(2);}
const header=Buffer.from('PROJECTOS-BACKUP-v1\n'),offset=header.length+24+12+16;
function writeAll(fd,buffer){
  let index=0;
  while(index<buffer.length){
    const written=writeSync(fd,buffer,index,buffer.length-index);
    if(written===0)throw Error('Restore output could not be written');
    index+=written;
  }
}
const dir=mkdtempSync(join(tmpdir(),'projectos-verify-encrypted-'));
let inputFd=null,outputFd=null;
try{
  const source=resolve(file);
  if(statSync(source).size<offset)throw Error('Backup too small');
  inputFd=openSync(source,'r');
  const meta=Buffer.alloc(offset);
  if(readSync(inputFd,meta,0,offset,0)!==offset||!meta.subarray(0,header.length).equals(header))throw Error('Unknown backup format');
  const salt=meta.subarray(header.length,header.length+24),iv=meta.subarray(header.length+24,header.length+36),tag=meta.subarray(header.length+36,offset);
  closeSync(inputFd);inputFd=null;
  const decipher=createDecipheriv('aes-256-gcm',scryptSync(passphrase,salt,32,{N:32768,r:8,p:1,maxmem:128*1024*1024}),iv);
  decipher.setAAD(header);decipher.setAuthTag(tag);
  const dest=join(dir,'restored.sqlite');
  outputFd=openSync(dest,'wx',0o600);
  for await(const chunk of createReadStream(source,{start:offset,highWaterMark:256*1024}))writeAll(outputFd,decipher.update(chunk));
  writeAll(outputFd,decipher.final());closeSync(outputFd);outputFd=null;
  const db=new DatabaseSync(dest);
  try{
    db.exec('PRAGMA foreign_keys=ON');
    if(Object.values(db.prepare('PRAGMA integrity_check').get())[0]!=='ok')throw Error('Integrity check failed');
    if(db.prepare('PRAGMA foreign_key_check').all().length)throw Error('Foreign key check failed');
    const count=db.prepare('SELECT COUNT(*) AS n FROM workspaces').get().n;
    db.exec('BEGIN IMMEDIATE');
    try{db.prepare('INSERT INTO workspaces(id,name,created_at) VALUES(?,?,?)').run('backup-test-only','Backup test',new Date().toISOString());db.exec('ROLLBACK');}
    catch(error){db.exec('ROLLBACK');throw error;}
    console.log(JSON.stringify({ok:true,encrypted:true,streaming:true,integrity:'ok',foreignKeys:'ok',workspaceCount:count,restore:'isolated-smoke'}));
  }finally{db.close();}
}catch(error){console.error('Restore verification failed:',error instanceof Error?error.message:'unknown error');process.exitCode=1;}
finally{
  if(inputFd!==null)try{closeSync(inputFd);}catch{}
  if(outputFd!==null)try{closeSync(outputFd);}catch{}
  rmSync(dir,{recursive:true,force:true});
}
