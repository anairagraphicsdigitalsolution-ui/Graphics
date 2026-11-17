import type { SupabaseClient } from '@supabase/supabase-js';
import { decryptSecret, encryptSecret } from '@/lib/growth-crypto';

/** Server-only workspace credential resolver. Never return its result to a client component or log it. */
export async function getWorkspaceIntegration(db: SupabaseClient, organizationId: string, provider: string) {
  const { data, error } = await db.from('growth_integrations').select('encrypted_credentials,settings,connection_status').eq('organization_id', organizationId).eq('provider', provider).maybeSingle();
  let workspaceCredentials: Record<string, any> = {};
  if (data?.encrypted_credentials) {
    try { workspaceCredentials = decryptSecret(data.encrypted_credentials) || {}; }
    catch { return { credentials: {} as Record<string, any>, settings: data.settings || {}, configured: false, error: 'Could not decrypt workspace integration credentials.' }; }
  }
  // Only application-level credentials may inherit from the Anaira platform vault.
  // Tenant tokens, account IDs, phone IDs, page IDs and refresh tokens never fall back.
  const platformProvider: Record<string, string> = { openai: 'openai', google_cse: 'google_cse', meta: 'meta_app', instagram: 'meta_app', google: 'google_oauth_app', youtube: 'google_oauth_app', google_ads: 'google_ads_developer', zerobounce: 'zerobounce', twilio_lookup: 'twilio_lookup', resend: 'resend_platform' };
  const allowedPlatformKeys: Record<string, string[]> = {
    openai: ['api_key'], google_cse: ['api_key'], meta: ['app_id','app_secret'], instagram: ['app_id','app_secret'],
    google: ['client_id','client_secret'], youtube: ['client_id','client_secret','api_key'], google_ads: ['developer_token'], zerobounce: ['api_key'],
    twilio_lookup: ['account_sid','auth_token'], resend: ['api_key'],
  };
  const platformKey = platformProvider[provider];
  let platformCredentials: Record<string, any> = {};
  let platformSettings: Record<string, any> = {};
  if (platformKey) {
    const { data: platformRow } = await db.from('growth_platform_integrations').select('encrypted_credentials,settings').eq('provider', platformKey).maybeSingle();
    if (platformRow?.encrypted_credentials && (platformRow.settings?.allow_shared_usage === true || ['meta_app','google_oauth_app','google_ads_developer'].includes(platformKey))) {
      try { platformCredentials = decryptSecret(platformRow.encrypted_credentials) || {}; platformSettings = platformRow.settings || {}; }
      catch { /* A broken platform fallback must not prevent a valid tenant-owned credential from working. */ }
    }
  }
  // Shared provider credentials are metered per workspace before being handed to a provider operation.
  // A missing/zero monthly cap blocks shared-key fallback; BYOK remains unaffected.
  if (Object.keys(platformCredentials).length && !Object.keys(workspaceCredentials).length && platformSettings.allow_shared_usage === true) {
    const limit = Math.max(0, Math.min(100000000, Number(platformSettings.monthly_limit_units) || 0));
    const { data: usageResult, error: usageError } = await db.rpc('consume_growth_platform_usage', {
      p_organization_id: organizationId, p_provider: provider, p_units: 1, p_monthly_limit: limit,
    });
    if (usageError || !usageResult?.allowed) {
      return { credentials: {} as Record<string, any>, settings: data?.settings || {}, configured: false, error: usageError ? 'Shared provider usage metering is unavailable; platform credentials are blocked.' : `Anaira shared ${provider} usage cap reached or not configured (${usageResult?.used || 0}/${usageResult?.limit || 0}).`, credentialSource: 'platform_default_blocked', workspaceConfigured: false, platformFallback: false };
    }
  }
  const credentials: Record<string, any> = { ...platformCredentials, ...workspaceCredentials };
  if (provider === 'google_ads') { const { data: oauthApp } = await db.from('growth_platform_integrations').select('encrypted_credentials').eq('provider','google_oauth_app').maybeSingle(); if (oauthApp?.encrypted_credentials) { try { const app = decryptSecret(oauthApp.encrypted_credentials) || {}; if (!credentials.client_id) credentials.client_id = app.client_id; if (!credentials.client_secret) credentials.client_secret = app.client_secret; } catch {} } }
  for (const key of Object.keys(platformCredentials)) if (!(allowedPlatformKeys[provider] || []).includes(key)) delete credentials[key];
  const settings = { ...(platformSettings || {}), ...(data?.settings || {}) };
  return { credentials, settings, configured: Object.values(credentials).some(Boolean), status: data?.connection_status || (Object.values(platformCredentials).some(Boolean) ? 'platform_fallback' : 'not_configured'), credentialSource: Object.keys(workspaceCredentials).length ? 'workspace_override' : Object.keys(platformCredentials).length ? 'platform_default' : 'none', workspaceConfigured: Object.values(workspaceCredentials).some(Boolean), platformFallback: Object.values(platformCredentials).some(Boolean), storageError: Boolean(error) };
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
  if (externalAccountId && !account) throw new Error(`${provider} account is not connected in this workspace.`);
  const vaultProvider = provider === 'instagram' || provider === 'meta' ? 'meta' : provider === 'google' ? 'youtube' : provider;
  const vault = await getWorkspaceIntegration(db, organizationId, vaultProvider);
  const credentials: any = account?.encrypted_credentials ? decryptSecret(account.encrypted_credentials) : vault.credentials;
  if (!credentials?.access_token) throw new Error(`${provider} OAuth access token is not connected.`);
  const expiresAt = account?.token_expires_at || credentials.token_expires_at || credentials.expires_at;
  // Meta Page/Instagram business tokens are not user refresh tokens. Their actual validity
  // is established by a signed provider API call, not by the parent user-token expiry.
  if (provider === 'meta' || provider === 'instagram') return String(credentials.access_token);
  const expiry = expiresAt ? new Date(expiresAt).getTime() : 0;
  if (!expiry || expiry > Date.now() + 120000) return String(credentials.access_token);

  const app: any = vault.credentials || {};
  const clientId = app.client_id || app.app_id;
  const clientSecret = app.client_secret || app.app_secret || app.app_id_secret;
  if (!clientId || !clientSecret) throw new Error(`${provider} access token expired. Add OAuth app credentials and reconnect.`);
  // Meta and Instagram tokens return above: they are long-lived page/business
  // tokens and must not enter the OAuth refresh-token flow below. At this point
  // TypeScript correctly narrows provider to google | youtube | linkedin.
  let endpoint = 'https://oauth2.googleapis.com/token';
  if (!credentials.refresh_token) throw new Error(`${provider} access token expired and no refresh token is available. Reconnect the account.`);
  if (provider === 'linkedin') endpoint = 'https://www.linkedin.com/oauth/v2/accessToken';
  const body = new URLSearchParams({ grant_type: 'refresh_token', refresh_token: credentials.refresh_token, client_id: clientId, client_secret: clientSecret });
  const response = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body, cache: 'no-store', signal: AbortSignal.timeout(15000) });
  const payload: any = await response.json().catch(() => ({}));
  if (!response.ok || !payload.access_token) throw new Error(String(payload.error_description || payload.error || `${provider} token refresh failed.`));
  credentials.access_token = payload.access_token;
  if (payload.refresh_token) credentials.refresh_token = payload.refresh_token;
  credentials.token_expires_at = payload.expires_in ? new Date(Date.now() + Number(payload.expires_in) * 1000).toISOString() : null;

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
  const rotatedAt = new Date().toISOString();
  const { data: priorVault } = await db.from('growth_integrations').select('credential_version').eq('organization_id', organizationId).eq('provider', vaultProvider).maybeSingle();
  await db.from('growth_integrations').upsert({
    organization_id: organizationId,
    provider: vaultProvider,
    display_name: vaultProvider === 'youtube' ? 'YouTube Data API' : vaultProvider === 'linkedin' ? 'LinkedIn' : 'Meta / Facebook / Instagram',
    encrypted_credentials: encryptSecret({ ...app, ...credentials, client_id: clientId, client_secret: clientSecret }),
    settings: vault.settings || {},
    connection_status: 'connected',
    last_success_at: rotatedAt,
    credential_version: (Number(priorVault?.credential_version) || 1) + 1,
    credential_rotated_at: rotatedAt,
    updated_at: rotatedAt,
  }, { onConflict: 'organization_id,provider' });
  await db.from('growth_integration_events').insert({
    organization_id: organizationId, provider: vaultProvider, event_type: 'credential_rotated',
    status: 'success', message: 'OAuth access token refreshed and encrypted in workspace vault.',
    metadata: { credential_version: (Number(priorVault?.credential_version) || 1) + 1, token_refreshed_at: rotatedAt },
  });
  return String(credentials.access_token);
}
