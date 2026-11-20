import type { DemoData } from './types';

export const emptyData: DemoData = {
  projects:[],tasks:[],resources:[],secrets:[],reminders:[],incidents:[],expenses:[],charges:[],contracts:[],revenues:[],
  invoices:[],payments:[],docs:[],events:[],
  users:[],
  integrations:[
    {id:'github',name:'GitHub',description:'مخزن و Issue — اتصال برقرار نیست',art:'infrastructure/git-branch',protocol:'API',connected:false},
    {id:'coolify',name:'Coolify',description:'استقرار — اتصال برقرار نیست',art:'infrastructure/deployment',protocol:'API',connected:false},
    {id:'infisical',name:'Infisical',description:'خزانه — اتصال برقرار نیست',art:'navigation/vault',protocol:'API',connected:false},
    {id:'uptime',name:'Uptime Kuma',description:'مانیتورینگ — اتصال برقرار نیست',art:'navigation/monitoring',protocol:'Webhook',connected:false},
  ],
  preferences:{workspace:'فضای کاری شخصی',displayName:'مدیر فضای کاری',theme:'dark',language:'fa',zone:'Asia/Tehran',digest:false,renewal:true,outage:false,stale:true},
};
