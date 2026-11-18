import { NextRequest, NextResponse } from 'next/server';
import { getCurrentAccount,checkOrigin,readLimitedJson,RequestBodyTooLargeError } from '@/lib/server/auth';
import { appendManualActivity,ActivityValidationError,ActivityRateLimitError } from '@/lib/server/manual-activity';
import { ForbiddenError } from '@/lib/server/db';
export const runtime='nodejs';
const headers={'Cache-Control':'no-store'};
export async function POST(request:NextRequest){
  const user=await getCurrentAccount();
  if(!user)return NextResponse.json({error:'Unauthenticated'},{status:401,headers});
  if(!checkOrigin(request))return NextResponse.json({error:'Forbidden'},{status:403,headers});
  try{
    const payload=await readLimitedJson(request,2048);
    appendManualActivity(user,payload);
    return NextResponse.json({ok:true},{headers});
  }catch(error){
    if(error instanceof RequestBodyTooLargeError)return NextResponse.json({error:'Payload too large'},{status:413,headers});
    if(error instanceof ForbiddenError)return NextResponse.json({error:'Forbidden'},{status:403,headers});
    if(error instanceof ActivityRateLimitError)return NextResponse.json({error:'Too many activity entries'},{status:429,headers});
    if(error instanceof ActivityValidationError)return NextResponse.json({error:'Invalid activity details'},{status:422,headers});
    return NextResponse.json({error:'Invalid JSON or unavailable service'},{status:400,headers});
  }
}
