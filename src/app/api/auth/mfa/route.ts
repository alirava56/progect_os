import {NextRequest,NextResponse} from 'next/server';
import {getCurrentAccount,checkOrigin,authenticate, readLimitedJson} from '@/lib/server/auth';
import {beginMfa,confirmMfa,mfaEnabled,issueRecoveryCodes,remainingRecoveryCodes,verifyMfa} from '@/lib/server/mfa';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function GET(){
  const account=await getCurrentAccount();
  if(!account)return NextResponse.json({error:'Unauthorized'},{status:401});
  return NextResponse.json({enabled:mfaEnabled(account.id),recoveryCodesRemaining:remainingRecoveryCodes(account.id)},{headers:{'Cache-Control':'no-store'}});
}
export async function POST(request:NextRequest){
  const account=await getCurrentAccount();
  if(!account)return NextResponse.json({error:'Unauthorized'},{status:401});
  if(!checkOrigin(request))return NextResponse.json({error:'Forbidden'},{status:403});
  let input:unknown;try{input=await readLimitedJson(request,4096);}catch{return NextResponse.json({error:'Invalid JSON'},{status:400});}
  const body=input as {action?:unknown;password?:unknown;code?:unknown};
  if(!body||typeof body!=='object')return NextResponse.json({error:'Invalid body'},{status:400});
  if(body.action==='start'){
    if(mfaEnabled(account.id))return NextResponse.json({error:'Already enrolled'},{status:409});
    if(authenticate(account.email,body.password)!==account.id)return NextResponse.json({error:'Re-authentication required'},{status:403});
    try{return NextResponse.json(beginMfa(account.id,account.email),{headers:{'Cache-Control':'no-store'}});}
    catch{return NextResponse.json({error:'MFA encryption key not configured'},{status:503});}
  }
  if(body.action==='rotate-recovery'){
    if(!mfaEnabled(account.id)||authenticate(account.email,body.password)!==account.id||!verifyMfa(account.id,body.code))
      return NextResponse.json({error:'Re-authentication and fresh MFA required'},{status:403});
    return NextResponse.json({ok:true,recoveryCodes:issueRecoveryCodes(account.id)},{headers:{'Cache-Control':'no-store'}});
  }
  if(body.action==='confirm'){
    if(!confirmMfa(account.id,body.code))return NextResponse.json({ok:false},{status:422,headers:{'Cache-Control':'no-store'}});
    return NextResponse.json({ok:true,recoveryCodes:issueRecoveryCodes(account.id)},{headers:{'Cache-Control':'no-store'}});
  }
  return NextResponse.json({error:'Unsupported action'},{status:400});
}
