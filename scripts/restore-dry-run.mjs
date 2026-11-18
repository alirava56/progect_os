#!/usr/bin/env node
/** Restore to an isolated temp copy and validate basic DB behavior. Never overwrites the active database. */
import { DatabaseSync } from 'node:sqlite';
import { copyFileSync,mkdtempSync,rmSync,existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join,resolve } from 'node:path';
import {randomUUID} from 'node:crypto';
const source=process.argv[2];if(!source||!existsSync(resolve(source))){console.error('Usage: npm run test:restore -- <backup.sqlite>');process.exit(2);}
const dir=mkdtempSync(join(tmpdir(),'projectos-restore-'));
try{
  const restored=join(dir,'restored.sqlite');copyFileSync(resolve(source),restored);
  const db=new DatabaseSync(restored);
  try{
    db.exec('PRAGMA foreign_keys=ON');
    const integrity=Object.values(db.prepare('PRAGMA integrity_check').get())[0];
    if(integrity!=='ok')throw new Error('Invalid SQLite integrity');
    const broken=db.prepare('PRAGMA foreign_key_check').all();if(broken.length)throw Error('Broken foreign keys');
    const workspaces=db.prepare('SELECT COUNT(*) AS n FROM workspaces').get().n;
    const projects=db.prepare("SELECT COUNT(*) AS n FROM records WHERE kind='projects'").get().n;
    db.exec('BEGIN IMMEDIATE');
    try{
      db.prepare('INSERT INTO workspaces(id,name,created_at) VALUES(?,?,?)').run(randomUUID(),'Restore validation',new Date().toISOString());
      db.exec('ROLLBACK');
    }catch(e){db.exec('ROLLBACK');throw e;}
    console.log(JSON.stringify({ok:true,integrity,foreignKeyErrors:0,workspaces,projects,mode:'isolated-restore-smoke-test'}));
  }finally{db.close();}
}finally{rmSync(dir,{recursive:true,force:true});}
