import { NextRequest, NextResponse } from 'next/server';
import { checkOrigin, getCurrentAccount, readLimitedJson, RequestBodyTooLargeError, requireMfa } from '@/lib/server/auth';
import { loadState, saveState, ForbiddenError, VersionConflictError } from '@/lib/server/db';
import { parseState, ValidationError } from '@/lib/server/validation';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function GET() {
  const user=await getCurrentAccount();
  if(!user)return NextResponse.json({error:'Unauthenticated'},{status:401});
  return NextResponse.json(await loadState(user),{headers:{'Cache-Control':'private, no-store'}});
}
export async function PUT(request:NextRequest) {
  const user=await getCurrentAccount();
  if(!user)return NextResponse.json({error:'Unauthenticated'},{status:401});
  if(!checkOrigin(request))return NextResponse.json({error:'Origin rejected'},{status:403});
  if(user.role!=='owner')return NextResponse.json({error:'Forbidden'},{status:403});
  if(requireMfa())return NextResponse.json({error:'Use the record write API'},{status:405,headers:{'Cache-Control':'private, no-store','Allow':'GET'}});
  let payload:unknown;
  try{payload=await readLimitedJson(request,2*1024*1024);}
  catch(error){return NextResponse.json({error:error instanceof RequestBodyTooLargeError?'Payload too large':'Invalid JSON'},
    {status:error instanceof RequestBodyTooLargeError?413:400});}
  if(!payload || typeof payload!=='object')return NextResponse.json({error:'Bad request'},{status:400});
  const body=payload as {version?:unknown;data?:unknown};
  if(!Number.isSafeInteger(body.version)||Number(body.version)<0)return NextResponse.json({error:'Invalid revision'},{status:400});
  try{
    const state=parseState(body.data);
    const version=await saveState(user,body.version as number,state);
    return NextResponse.json({ok:true,version},{headers:{'Cache-Control':'no-store'}});
  }catch(error){
    if(error instanceof ValidationError)return NextResponse.json({error:error.reason},{status:422});
    if(error instanceof VersionConflictError)return NextResponse.json({error:'Concurrent update. Reload the page before continuing.'},{status:409});
    if(error instanceof ForbiddenError)return NextResponse.json({error:'Forbidden'},{status:403});
    return NextResponse.json({error:'State could not be saved'},{status:500});
  }
}
