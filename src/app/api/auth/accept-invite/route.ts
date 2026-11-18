import {NextRequest,NextResponse} from 'next/server';
import {acceptInvitation} from '@/lib/server/invitations';
import {checkOrigin,readLimitedJson,setSessionCookie,newSession} from '@/lib/server/auth';
export const runtime='nodejs';
export async function POST(request:NextRequest){
  if(!checkOrigin(request))return NextResponse.json({error:'Origin rejected'},{status:403});
  try{
    const data=await readLimitedJson(request,2048) as Parameters<typeof acceptInvitation>[0];
    const userId=acceptInvitation(data);
    await setSessionCookie(newSession(userId));
    return NextResponse.json({ok:true},{headers:{'Cache-Control':'no-store'}});
  }catch{return NextResponse.json({error:'Invitation is invalid, expired or already used'},{status:422});}
}
