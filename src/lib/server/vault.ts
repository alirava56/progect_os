import type { SecretReference } from '../types';

export type VaultCheck = { status: 'verified' | 'unknown' | 'not_found' | 'not_configured'; providerVersion: number | null };
export type VaultSettings = { origin: string; token: string; mounts: ReadonlySet<string> };

export function vaultSettings(workspaceId: string, env = process.env): VaultSettings | undefined {
  const token = env.PROJECTOS_VAULT_TOKEN;
  if (workspaceId !== env.PROJECTOS_VAULT_WORKSPACE || !token || !env.PROJECTOS_VAULT_ORIGIN) return;
  try {
    const url = new URL(env.PROJECTOS_VAULT_ORIGIN);
    if (url.protocol !== 'https:' || url.origin !== env.PROJECTOS_VAULT_ORIGIN || url.username || url.password) return;
    const mounts = new Set((env.PROJECTOS_VAULT_MOUNTS ?? '').split(',').map(mount => mount.trim()).filter(Boolean));
    return mounts.size ? { origin:url.origin, token, mounts } : undefined;
  } catch { return; }
}

export async function verifyVaultReference(reference: SecretReference, settings?: VaultSettings, request = fetch): Promise<VaultCheck> {
  const { vaultMount, vaultPath, vaultProvider } = reference;
  if (vaultProvider !== 'HashiCorp Vault' || !vaultMount || !vaultPath || !settings?.mounts.has(vaultMount)
    || !/^[a-zA-Z0-9_-]+$/.test(vaultMount) || !vaultPath.split('/').every(value => /^[a-zA-Z0-9_-]+$/.test(value))) {
    return { status:'not_configured', providerVersion:null };
  }
  try {
    const endpoint = new URL('/v1/' + vaultMount + '/metadata/' + vaultPath, settings.origin);
    const response = await request(endpoint, {
      method:'GET', headers:{'X-Vault-Token':settings.token}, redirect:'error', cache:'no-store', signal:AbortSignal.timeout(6000),
    });
    if (response.status === 404) return {status:'not_found', providerVersion:null};
    if (!response.ok) return {status:'unknown', providerVersion:null};
    const body = await response.json() as {data?: {current_version?: unknown; versions?: Record<string, {destroyed?: boolean; deletion_time?: string}>}};
    const version = body.data?.current_version;
    if (typeof version !== 'number' || !Number.isSafeInteger(version) || version < 1) return {status:'unknown', providerVersion:null};
    const metadata = body.data?.versions?.[String(version)];
    if (!metadata || metadata.destroyed || metadata.deletion_time) return {status:'unknown', providerVersion:null};
    return {status:'verified', providerVersion:version};
  } catch {
    return {status:'unknown', providerVersion:null};
  }
}