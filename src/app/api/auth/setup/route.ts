import { NextRequest, NextResponse } from 'next/server';
import { checkOrigin, newSession, setSessionCookie, setupOwner , readLimitedJson} from '@/lib/server/auth';
export const runtime='nodejs';
export async function POST(request:NextRequest) {
  if(!checkOrigin(request))return NextResponse.json({error:'Origin rejected'},{status:403});
  let input:unknown;try{input=await readLimitedJson(request,4096);}catch{return NextResponse.json({error:'Malformed body'},{status:400});}
  if(!input || typeof input!=='object')return NextResponse.json({error:'Invalid request'},{status:400});
  try{
    const owner=setupOwner(input as Parameters<typeof setupOwner>[0]);
    await setSessionCookie(newSession(owner));
    return NextResponse.json({ok:true},{headers:{'Cache-Control':'no-store'}});
  }catch{
    return NextResponse.json({error:'Setup rejected; verify the setup token, inputs and whether an account already exists.'},{status:400});
  }
}
