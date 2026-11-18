/** Restricted links to the user's external vault web UI. No credential values pass through ProjectOS. */
const allowedHosts = new Set([
  'start.1password.com','my.1password.com','app.1password.com',
  'vault.bitwarden.com','vault.bitwarden.eu','app.bitwarden.com',
  'app.infisical.com'
]);
export function vaultLink(value:string|undefined):string|null {
  if(!value||value.length>500)return null;
  try{
    const url=new URL(value);
    if(url.protocol!=='https:'||url.username||url.password||url.port||!allowedHosts.has(url.hostname.toLowerCase()))return null;
    return url.toString();
  }catch{return null;}
}
