import { NextRequest,NextResponse } from 'next/server';
import { getCurrentAccount } from '@/lib/server/auth';
import { getDb } from '@/lib/server/db';
import {redactStoredValue} from '@/lib/server/credential-guard';
export const runtime='nodejs';
export async function GET(request:NextRequest){
  const account=await getCurrentAccount();
  if(!account)return NextResponse.json({error:'Unauthorized'},{status:401});
  const id=request.nextUrl.searchParams.get('id');
  if(!id||id.length>100)return NextResponse.json({error:'Invalid document id'},{status:400});
  const db=getDb();
  const doc=db.prepare('SELECT id FROM records WHERE workspace_id=? AND kind=? AND id=?').get(account.workspaceId,'docs',id);
  if(!doc)return NextResponse.json({error:'Not found'},{status:404});
  const revisions=db.prepare('SELECT revision,payload,saved_at AS savedAt FROM document_versions WHERE workspace_id=? AND document_id=? ORDER BY revision DESC LIMIT 100').all(account.workspaceId,id);
  return NextResponse.json({versions:revisions.map(row=>({...(redactStoredValue(JSON.parse(row.payload as string)) as object),savedAt:row.savedAt}))},{headers:{'Cache-Control':'private, no-store'}});
}
