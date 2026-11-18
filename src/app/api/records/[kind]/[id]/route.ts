import { NextRequest, NextResponse } from 'next/server';
import { checkOrigin, getCurrentAccount, readLimitedJson, RequestBodyTooLargeError } from '@/lib/server/auth';
import { loadState, ForbiddenError, VersionConflictError } from '@/lib/server/db';
import { isRecordKind, mutateRecord, MissingRecordError, DuplicateRecordError } from '@/lib/server/record-service';
import { ValidationError } from '@/lib/server/validation';
export const runtime='nodejs';
export const dynamic='force-dynamic';
type Ctx={params:Promise<{kind:string;id:string}>};
const noStore={'Cache-Control':'no-store'};
function failure(error:unknown){
  if(error instanceof ValidationError)return NextResponse.json({error:error.reason},{status:422,headers:noStore});
  if(error instanceof VersionConflictError)return NextResponse.json({error:'Concurrent update. Reload and retry.'},{status:409,headers:noStore});
  if(error instanceof ForbiddenError)return NextResponse.json({error:'Forbidden'},{status:403,headers:noStore});
  if(error instanceof MissingRecordError)return NextResponse.json({error:'Not found'},{status:404,headers:noStore});
  if(error instanceof DuplicateRecordError)return NextResponse.json({error:'Already exists'},{status:409,headers:noStore});
  return NextResponse.json({error:'Operation failed'},{status:500,headers:noStore});
}
export async function GET(_request:NextRequest,ctx:Ctx){
  const account=await getCurrentAccount();if(!account)return NextResponse.json({error:'Unauthenticated'},{status:401,headers:noStore});
  const {kind,id}=await ctx.params;if(!isRecordKind(kind))return NextResponse.json({error:'Invalid kind'},{status:404});
  const {data,version}=loadState(account);
  const record=data[kind].find(value=>value.id===id);
  return record?NextResponse.json({record,version},{headers:noStore}):NextResponse.json({error:'Not found'},{status:404,headers:noStore});
}
async function write(request:NextRequest,ctx:Ctx,action:'create'|'replace'|'delete'){
  const account=await getCurrentAccount();if(!account)return NextResponse.json({error:'Unauthenticated'},{status:401,headers:noStore});
  if(!checkOrigin(request))return NextResponse.json({error:'Origin rejected'},{status:403,headers:noStore});
  const {kind,id}=await ctx.params;if(!isRecordKind(kind))return NextResponse.json({error:'Invalid kind'},{status:404,headers:noStore});
  let body:unknown;
  try{body=await readLimitedJson(request,100000);}
  catch(error){return NextResponse.json({error:error instanceof RequestBodyTooLargeError?'Payload too large':'Invalid JSON'},
    {status:error instanceof RequestBodyTooLargeError?413:400,headers:noStore});}
  if(!body||typeof body!=='object'||Array.isArray(body))return NextResponse.json({error:'Invalid body'},{status:400,headers:noStore});
  const payload=body as {version?:unknown;record?:unknown};
  if(!Number.isSafeInteger(payload.version)||Number(payload.version)<0)return NextResponse.json({error:'Invalid revision'},{status:400,headers:noStore});
  try{
    const version=mutateRecord(account,payload.version as number,kind,id,action,payload.record);
    return NextResponse.json({ok:true,version},{headers:noStore});
  }catch(error){return failure(error);}
}
export const POST=(request:NextRequest,ctx:Ctx)=>write(request,ctx,'create');
export const PUT=(request:NextRequest,ctx:Ctx)=>write(request,ctx,'replace');
export const DELETE=(request:NextRequest,ctx:Ctx)=>write(request,ctx,'delete');
