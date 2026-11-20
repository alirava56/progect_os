import { NextRequest, NextResponse } from 'next/server';
import { getCurrentAccount,checkOrigin,readLimitedJson,RequestBodyTooLargeError } from '@/lib/server/auth';
import { appendManualActivity,ActivityValidationError,ActivityRateLimitError } from '@/lib/server/manual-activity';
import { validRecordId } from '@/lib/record-contract';
import { ForbiddenError, loadActivityById } from '@/lib/server/db';
import { apiError, noStore } from '@/lib/server/http';
import { ValidationError } from '@/lib/server/validation';
export const runtime='nodejs';
const headers={'Cache-Control':'no-store'};
export async function GET(request:NextRequest) {
  const account=await getCurrentAccount();
  if (!account) return apiError('Unauthenticated',401);
  const id=request.nextUrl.searchParams.get('event');
  if (!validRecordId(id)) return apiError('Invalid event',422);
  try {
    const activity=await loadActivityById(account,id);
    return activity ? NextResponse.json({activity},{headers:noStore}) : apiError('Not found',404);
  } catch (error) {
    return error instanceof ForbiddenError ? apiError('Permission changed',403) : apiError('Activity unavailable',503);
  }
}
export async function POST(request:NextRequest){
  const user=await getCurrentAccount();
  if(!user)return NextResponse.json({error:'Unauthenticated'},{status:401,headers});
  if(!checkOrigin(request))return NextResponse.json({error:'Forbidden'},{status:403,headers});
  try{
    const payload=await readLimitedJson(request,2048);
    await appendManualActivity(user,payload);
    return NextResponse.json({ok:true},{headers});
  }catch(error){
    if(error instanceof RequestBodyTooLargeError)return NextResponse.json({error:'Payload too large'},{status:413,headers});
    if(error instanceof ForbiddenError)return NextResponse.json({error:'Forbidden'},{status:403,headers});
    if(error instanceof ActivityRateLimitError)return NextResponse.json({error:'Too many activity entries'},{status:429,headers});
    if(error instanceof ActivityValidationError||error instanceof ValidationError)return NextResponse.json({error:'Invalid activity details'},{status:422,headers});
    return NextResponse.json({error:'Invalid JSON or unavailable service'},{status:400,headers});
  }
}
