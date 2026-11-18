import {NextRequest,NextResponse} from 'next/server';
import {getCurrentAccount,checkOrigin,readLimitedJson} from '@/lib/server/auth';
import {createInvitation,listInvitations,revokeInvitation} from '@/lib/server/invitations';
export const runtime='nodejs';export const dynamic='force-dynamic';
const headers={'Cache-Control':'private, no-store'};
export async function GET(){
  const account=await getCurrentAccount();if(!account)return NextResponse.json({error:'Unauthenticated'},{status:401,headers});
  if(account.role!=='owner')return NextResponse.json({error:'Forbidden'},{status:403,headers});
  return NextResponse.json({invitations:listInvitations(account)},{headers});
}
export async function POST(request:NextRequest){
  const account=await getCurrentAccount();if(!account)return NextResponse.json({error:'Unauthenticated'},{status:401,headers});
  if(account.role!=='owner'||!checkOrigin(request))return NextResponse.json({error:'Forbidden'},{status:403,headers});
  try{
    const input=await readLimitedJson(request,1024) as {email?:unknown;role?:unknown};
    const result=createInvitation(account,input?.email,input?.role);
    return NextResponse.json(result,{headers});
  }catch{return NextResponse.json({error:'Invitation rejected'},{status:422,headers});}
}
export async function DELETE(request:NextRequest){
  const account=await getCurrentAccount();if(!account)return NextResponse.json({error:'Unauthenticated'},{status:401,headers});
  if(account.role!=='owner'||!checkOrigin(request))return NextResponse.json({error:'Forbidden'},{status:403,headers});
  try{
    const input=await readLimitedJson(request,512) as {id?:unknown};
    if(typeof input?.id!=='string'||input.id.length>100)throw Error();
    return NextResponse.json({revoked:revokeInvitation(account,input.id)},{headers});
  }catch{return NextResponse.json({error:'Invalid invitation'},{status:422,headers});}
}
