import { NextRequest, NextResponse } from 'next/server';
import {cookies} from 'next/headers';
import {checkOrigin,getCurrentAccount,authenticate,COOKIE,readLimitedJson} from '@/lib/server/auth';
import {getDb} from '@/lib/server/db';
import {mfaEnabled,verifyMfa} from '@/lib/server/mfa';
import {createHash} from 'node:crypto';
export const runtime='nodejs';
export const dynamic='force-dynamic';
const headers={'Cache-Control':'private, no-store'};
export async function GET(){
  const account=await getCurrentAccount();
  if(!account)return NextResponse.json({error:'Unauthenticated'},{status:401,headers});
  const rows=getDb().prepare('SELECT created_at AS createdAt,expires_at AS expiresAt FROM sessions WHERE user_id=? AND expires_at>? ORDER BY created_at DESC').all(account.id,Date.now());
  // No session token or token hash leaves the server.
  return NextResponse.json({sessions:rows,count:rows.length},{headers});
}
export async function POST(request:NextRequest){
  const account=await getCurrentAccount();
  if(!account)return NextResponse.json({error:'Unauthenticated'},{status:401,headers});
  if(!checkOrigin(request))return NextResponse.json({error:'Origin rejected'},{status:403,headers});
  let input:unknown;try{input=await readLimitedJson(request,1000);}catch{return NextResponse.json({error:'Invalid JSON'},{status:400,headers});}
  if(!input||typeof input!=='object')return NextResponse.json({error:'Invalid body'},{status:400,headers});
  const {password,totp,action}=input as {password?:unknown;totp?:unknown;action?:unknown};
  if(action!=='revokeOthers'&&action!=='revokeAll')return NextResponse.json({error:'Unsupported action'},{status:422,headers});
  if(authenticate(account.email,password)!==account.id)return NextResponse.json({error:'Re-authentication failed'},{status:403,headers});
  if(mfaEnabled(account.id)&&!verifyMfa(account.id,totp))return NextResponse.json({error:'Second factor required'},{status:403,headers});
  const jar=await cookies();
  const token=jar.get(COOKIE)?.value;
  if(!token)return NextResponse.json({error:'Session missing'},{status:401,headers});
  const hash=createHash('sha256').update(token).digest('hex');
  const result=action==='revokeOthers'
    ?getDb().prepare('DELETE FROM sessions WHERE user_id=? AND token_hash<>?').run(account.id,hash)
    :getDb().prepare('DELETE FROM sessions WHERE user_id=?').run(account.id);
  if(action==='revokeAll')jar.delete(COOKIE);
  return NextResponse.json({ok:true,revoked:result.changes,signedOut:action==='revokeAll'},{headers});
}
