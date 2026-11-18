import {NextRequest,NextResponse} from 'next/server';
import {checkOrigin,getCurrentAccount} from '@/lib/server/auth';
import {removeMember} from '@/lib/server/invitations';
export const runtime='nodejs';
export async function DELETE(request:NextRequest,{params}:{params:Promise<{id:string}>}){
  const account=await getCurrentAccount();if(!account)return NextResponse.json({error:'Unauthenticated'},{status:401});
  if(account.role!=='owner'||!checkOrigin(request))return NextResponse.json({error:'Forbidden'},{status:403});
  const {id}=await params;
  if(!/^[a-zA-Z0-9-]{1,100}$/.test(id))return NextResponse.json({error:'Invalid member id'},{status:422});
  try{return NextResponse.json({removed:removeMember(account,id)},{headers:{'Cache-Control':'no-store'}});}
  catch{return NextResponse.json({error:'Member cannot be removed'},{status:422});}
}
