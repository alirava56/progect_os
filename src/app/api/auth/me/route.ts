import { NextResponse } from 'next/server';
import { getCurrentAccount, userCount } from '@/lib/server/auth';
export const runtime='nodejs';
export async function GET(){
  const account=await getCurrentAccount();
  return NextResponse.json({authenticated:!!account,account:account?{email:account.email,displayName:account.displayName,role:account.role}:null,setupRequired:userCount()===0},{headers:{'Cache-Control':'no-store'}});
}
