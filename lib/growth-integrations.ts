import type { SupabaseClient } from '@supabase/supabase-js';
import { decryptSecret, encryptSecret } from '@/lib/growth-crypto';

/** Server-only workspace credential resolver. Never return its result to a client component or log it. */
export async function getWorkspaceIntegration(db: SupabaseClient, organizationId: string, provider: string) {
  const { data, error } = await db.from('growth_integrations').select('encrypted_credentials,settings,connection_status').eq('organization_id', organizationId).eq('provider', provider).maybeSingle();
  if (error || !data) return { credentials: {} as Record<string, any>, settings: {} as Record<string, any>, configured: false };
  try {
    const credentials = decryptSecret(data.encrypted_credentials) || {};
    return { credentials, settings: data.settings || {}, configured: Object.values(credentials).some(Boolean), status: data.connection_status };
  } catch {
    return { credentials: {} as Record<string, any>, settings: {} as Record<string, any>, configured: false, error: 'Could not decrypt workspace integration credentials.' };
  }
}

/**
 * Returns a current OAuth token for a connected social account. When the provider
 * token is near expiry it refreshes it server-side and persists the rotated token
 * in both the social-account record and central encrypted integration vault.
 */
export async function getWorkspaceAccessToken(
  db: SupabaseClient,
  organizationId: string,
  provider: 'google' | 'youtube' | 'linkedin' | 'instagram' | 'meta',
  externalAccountId?: string,
) {
  const platform = provider === 'google' ? 'youtube' : provider === 'meta' ? 'facebook' : provider;
  let accountQuery = db.from('growth_social_accounts')
    .select('id,external_account_id,encrypted_credentials,token_expires_at,metadata')
    .eq('organization_id', organizationId).eq('platform', platform).eq('connection_status', 'connected');
  if (externalAccountId) accountQuery = accountQuery.eq('external_account_id', externalAccountId);
  const { data: account } = await accountQuery.order('created_at', { ascending: false }).limit(1).maybeSingle();
  const vaultProvider = provider === 'instagram' || provider === 'meta' ? 'meta' : provider === 'google' ? 'youtube' : provider;
  const vault = await getWorkspaceIntegration(db, organizationId, vaultProvider);
  const credentials: any = account?.encrypted_credentials ? decryptSecret(account.encrypted_credentials) : vault.credentials;
  if (!credentials?.access_token) throw new Error(`${provider} OAuth access token is not connected.`);
  const expiresAt = account?.token_expires_at || credentials.token_expires_at || credentials.expires_at;
  const expiry = expiresAt ? new Date(expiresAt).getTime() : 0;
  if (!expiry || expiry > Date.now() + 120000) return String(credentials.access_token);

  const app: any = vault.credentials || {};
  const clientId = app.client_id || app.app_id;
  const clientSecret = app.client_secret || app.app_secret || app.app_id_secret;
  if (!clientId || !clientSecret) throw new Error(`${provider} access token expired. Add OAuth app credentials and reconnect.`);
  let endpoint = 'https://oauth2.googleapis.com/token';
  let body: URLSearchParams;
  if (provider === 'instagram' || provider === 'meta') {
    const url = new URL('https://graph.facebook.com/v22.0/oauth/access_token');
    url.searchParams.set('grant_type', 'fb_exchange_token');
    url.searchParams.set('client_id', clientId);
    url.searchParams.set('client_secret', clientSecret);
    url.searchParams.set('fb_exchange_token', credentials.access_token);
    const response = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(15000) });
    const payload: any = await response.json().catch(() => ({}));
    if (!response.ok || !payload.access_token) throw new Error(String(payload.error?.message || 'Meta token refresh failed.'));
    credentials.access_token = payload.access_token;
    credentials.token_expires_at = payload.expires_in ? new Date(Date.now() + Number(payload.expires_in) * 1000).toISOString() : null;
  } else {
    if (!credentials.refresh_token) throw new Error(`${provider} access token expired and no refresh token is available. Reconnect the account.`);
    if (provider === 'linkedin') endpoint = 'https://www.linkedin.com/oauth/v2/accessToken';
    body = new URLSearchParams({ grant_type: 'refresh_token', refresh_token: credentials.refresh_token, client_id: clientId, client_secret: clientSecret });
    const response = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body, cache: 'no-store', signal: AbortSignal.timeout(15000) });
    const payload: any = await response.json().catch(() => ({}));
    if (!response.ok || !payload.access_token) throw new Error(String(payload.error_description || payload.error || `${provider} token refresh failed.`));
    credentials.access_token = payload.access_token;
    if (payload.refresh_token) credentials.refresh_token = payload.refresh_token;
    credentials.token_expires_at = payload.expires_in ? new Date(Date.now() + Number(payload.expires_in) * 1000).toISOString() : null;
  }

  const encrypted = encryptSecret(credentials);
  if (account?.id) {
    const { error } = await db.from('growth_social_accounts').update({
      encrypted_credentials: encrypted,
      token_expires_at: credentials.token_expires_at || null,
      connection_status: 'connected',
      metadata: { ...(account.metadata || {}), token_refreshed_at: new Date().toISOString() },
    }).eq('id', account.id);
    if (error) throw new Error(`${provider} token refreshed but could not be saved to the connected account.`);
  }
  await db.from('growth_integrations').upsert({
    organization_id: organizationId,
    provider: vaultProvider,
    display_name: vaultProvider === 'youtube' ? 'YouTube Data API' : vaultProvider === 'linkedin' ? 'LinkedIn' : 'Meta / Facebook / Instagram',
    encrypted_credentials: encryptSecret({ ...app, ...credentials, client_id: clientId, client_secret: clientSecret }),
    settings: vault.settings || {},
    connection_status: 'connected',
    last_success_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }, { onConflict: 'organization_id,provider' });
  return String(credentials.access_token);
}
