#!/usr/bin/env node
/** Run optional workers only after explicit operator opt-in. Each failure is reported. */
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {dirname,join} from 'node:path';
const root=dirname(fileURLToPath(import.meta.url));
const tasks=[
  ...(process.env.PROJECTOS_MONITOR_HOSTS?[['run-monitors.mjs', 'monitoring']]:[]),
  ...(process.env.PROJECTOS_TELEGRAM_NOTIFICATIONS==='enabled'?[['deliver-notifications.mjs','telegram']]:[])
];
let failures=0;
for(const [script,name] of tasks){
  const result=spawnSync(process.execPath,[join(root,script)],{env:process.env,stdio:'inherit',timeout:90_000});
  if(result.status!==0){failures++;console.error(`Optional ${name} worker failed with code ${result.status??'signal'}`);}
}
if(failures)process.exitCode=1;
