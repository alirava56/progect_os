/** Explicitly allowlisted, read-only GitHub repository overview. No token reaches the browser. */
import {NextResponse} from 'next/server';
import {getCurrentAccount} from '@/lib/server/auth';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function GET(){
  const account=await getCurrentAccount();
  if(!account)return NextResponse.json({error:'Unauthenticated'},{status:401});
  if(account.role!=='owner')return NextResponse.json({error:'Forbidden'},{status:403});
  const token=process.env.PROJECTOS_GITHUB_TOKEN;
  const repos=(process.env.PROJECTOS_GITHUB_REPOS||'').split(',').map(x=>x.trim()).filter(Boolean);
  if(!token||!repos.length)return NextResponse.json({status:'not_configured',repositories:[]},{headers:{'Cache-Control':'no-store'}});
  if(repos.length>20||repos.some(x=>!/^[a-zA-Z0-9_.-]{1,100}\/[a-zA-Z0-9_.-]{1,100}$/.test(x))){
    return NextResponse.json({error:'Invalid server repository allowlist'},{status:503});
  }
  const repositories=[];
  for(const repo of repos){
    try{
      const [owner,name]=repo.split('/');
      const response=await fetch(`https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(name)}`,{
        headers:{Authorization:`Bearer ${token}`,Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28','User-Agent':'ProjectOS/1.0'},
        signal:AbortSignal.timeout(7000),cache:'no-store',redirect:'error'
      });
      if(!response.ok){repositories.push({repository:repo,state:'unknown'});continue;}
      const json=await response.json();
      repositories.push({repository:repo,state:'connected',fullName:String(json.full_name||repo),
        private:Boolean(json.private),defaultBranch:String(json.default_branch||''),openIssues:Number(json.open_issues_count||0),
        updatedAt:typeof json.pushed_at==='string'?json.pushed_at:null,url:`https://github.com/${repo}`});
    }catch{repositories.push({repository:repo,state:'unknown'});}
  }
  return NextResponse.json({status:'configured',repositories},{headers:{'Cache-Control':'no-store'}});
}
