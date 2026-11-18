import { NextRequest, NextResponse } from 'next/server';
import { checkOrigin, signOut } from '@/lib/server/auth';
export const runtime='nodejs';
export async function POST(request:NextRequest){
  if(!checkOrigin(request))return NextResponse.json({error:'Origin rejected'},{status:403});
  await signOut();
  return NextResponse.json({ok:true},{headers:{'Cache-Control':'no-store'}});
}
