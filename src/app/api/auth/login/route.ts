import { NextRequest, NextResponse } from 'next/server';
import { authenticate, checkOrigin, newSession, setSessionCookie , readLimitedJson} from '@/lib/server/auth';
import {mfaEnabled,verifyMfa,verifyRecoveryCode} from '@/lib/server/mfa';
export const runtime='nodejs';
export async function POST(request:NextRequest) {
  if(!checkOrigin(request))return NextResponse.json({error:'Origin rejected'},{status:403});
  let input:unknown;try{input=await readLimitedJson(request,4096);}catch{return NextResponse.json({error:'Malformed body'},{status:400});}
  if(!input||typeof input!=='object')return NextResponse.json({error:'Invalid credentials'},{status:401});
  const body=input as {email?:unknown;password?:unknown;totp?:unknown;recoveryCode?:unknown};
  const owner=authenticate(body.email,body.password);
  if(!owner)return NextResponse.json({error:'Invalid credentials or temporarily locked account'},{status:401});
  const usingRecovery=typeof body.recoveryCode==='string';
  if(mfaEnabled(owner)&&!(usingRecovery?verifyRecoveryCode(owner,body.recoveryCode):verifyMfa(owner,body.totp)))
    return NextResponse.json({error:'Invalid credentials or second factor'},{status:401});
  await setSessionCookie(newSession(owner));
  return NextResponse.json({ok:true,recoveryUsed:usingRecovery&&mfaEnabled(owner)},{headers:{'Cache-Control':'no-store'}});
}
