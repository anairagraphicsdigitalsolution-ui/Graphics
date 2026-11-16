import { decryptSecret, encryptSecret } from '@/lib/growth-crypto';

const API_VERSION = process.env.GOOGLE_ADS_API_VERSION || 'v26';
const ADS_SCOPE = 'https://www.googleapis.com/auth/adwords';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const enc = (v: unknown) => typeof v === 'string' ? v.trim() : '';

export function normalizeCustomerId(value: unknown) {
  return enc(value).replace(/\D/g, '').slice(0, 20);
}

export async function readPlatformGoogleAdsConfig(db: any) {
  const [{ data: oauth }, { data: developer }] = await Promise.all([
    db.from('growth_platform_integrations').select('encrypted_credentials,settings').eq('provider', 'google_oauth_app').maybeSingle(),
    db.from('growth_platform_integrations').select('encrypted_credentials,settings').eq('provider', 'google_ads_developer').maybeSingle(),
  ]);
  let oauthSecrets: any = {}, developerSecrets: any = {};
  try { oauthSecrets = decryptSecret(oauth?.encrypted_credentials || '') || {}; } catch {}
  try { developerSecrets = decryptSecret(developer?.encrypted_credentials || '') || {}; } catch {}
  return {
    clientId: enc(oauthSecrets.client_id), clientSecret: enc(oauthSecrets.client_secret),
    redirectUri: enc(oauth?.settings?.redirect_uri) || `${enc(process.env.NEXT_PUBLIC_SITE_URL || process.env.APP_URL).replace(/\/$/, '')}/api/growth/google-ads/oauth/callback`,
    developerToken: enc(developerSecrets.developer_token),
    loginCustomerId: normalizeCustomerId(developer?.settings?.login_customer_id),
    monthlyLimitUnits: Math.max(0, Math.min(100000000, Number(developer?.settings?.monthly_limit_units) || 0)),
    apiVersion: `v${enc(developer?.settings?.api_version).replace(/^v/, '') || API_VERSION.replace(/^v/, '')}`, 
  };
}

export async function readWorkspaceGoogleAdsOAuthConfig(db: any, organizationId: string) {
  const platform = await readPlatformGoogleAdsConfig(db);
  const { data } = await db.from('growth_integrations').select('encrypted_credentials,settings').eq('organization_id', organizationId).eq('provider', 'google_ads').maybeSingle();
  let credentials: any = {};
  if (data?.encrypted_credentials) { try { credentials = decryptSecret(data.encrypted_credentials) || {}; } catch { throw new Error('Client Google Ads OAuth credentials cannot be decrypted.'); } }
  return {
    clientId: enc(credentials.client_id) || platform.clientId,
    clientSecret: enc(credentials.client_secret) || platform.clientSecret,
    redirectUri: enc(data?.settings?.redirect_uri) || platform.redirectUri,
    developerToken: platform.developerToken,
    loginCustomerId: normalizeCustomerId(data?.settings?.login_customer_id || platform.loginCustomerId),
    apiVersion: platform.apiVersion,
  };
}

export async function readWorkspaceGoogleAds(db: any, organizationId: string) {
  const { data, error } = await db.from('growth_integrations').select('id,encrypted_credentials,settings').eq('organization_id', organizationId).eq('provider', 'google_ads').maybeSingle();
  if (error || !data) throw new Error('Connect Google Ads in this workspace first.');
  let credentials: any = {};
  try { credentials = decryptSecret(data.encrypted_credentials || '') || {}; } catch { throw new Error('Google Ads credentials cannot be decrypted. Check GROWTH_TOKEN_ENCRYPTION_KEY.'); }
  return { row: data, credentials, settings: data.settings || {} };
}

export async function refreshGoogleAdsAccessToken(db: any, organizationId: string) {
  const platform = await readPlatformGoogleAdsConfig(db);
  const workspace = await readWorkspaceGoogleAds(db, organizationId);
  const clientId = enc(workspace.credentials.client_id) || platform.clientId;
  const clientSecret = enc(workspace.credentials.client_secret) || platform.clientSecret;
  const refreshToken = enc(workspace.credentials.refresh_token);
  if (!clientId || !clientSecret || !refreshToken || !platform.developerToken) throw new Error('Google Ads setup incomplete: platform OAuth app + developer token and workspace refresh token are required.');
  const { data: metering, error: meteringError } = await db.rpc('consume_growth_platform_usage', { p_organization_id: organizationId, p_provider: 'google_ads', p_units: 1, p_monthly_limit: platform.monthlyLimitUnits });
  if (meteringError || !metering?.allowed) throw new Error(meteringError ? 'Google Ads platform usage metering is unavailable; API access is blocked.' : `Google Ads monthly platform API cap reached or not configured (${metering?.used || 0}/${metering?.limit || 0}). Set a platform or plan monthly cap in Anaira Developer APIs.`);
  const response = await fetch(GOOGLE_TOKEN_URL, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, refresh_token: refreshToken, grant_type: 'refresh_token' }), cache: 'no-store' });
  const token = await response.json().catch(() => ({}));
  if (!response.ok || !token.access_token) throw new Error(token.error_description || token.error || 'Google OAuth token refresh failed. Reconnect Google Ads.');
  return { accessToken: String(token.access_token), developerToken: platform.developerToken, loginCustomerId: normalizeCustomerId(workspace.settings.login_customer_id || platform.loginCustomerId), apiVersion: platform.apiVersion, customerId: normalizeCustomerId(workspace.settings.customer_id || workspace.credentials.customer_id), workspace };
}

export async function googleAdsRequest(config: { accessToken: string; developerToken: string; loginCustomerId?: string; apiVersion: string }, path: string, body: unknown) {
  const headers: Record<string, string> = { Authorization: `Bearer ${config.accessToken}`, 'developer-token': config.developerToken, 'Content-Type': 'application/json' };
  if (config.loginCustomerId) headers['login-customer-id'] = config.loginCustomerId;
  const response = await fetch(`https://googleads.googleapis.com/${config.apiVersion}/${path.replace(/^\//, '')}`, { method: 'POST', headers, body: JSON.stringify(body), cache: 'no-store' });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = payload?.error?.details?.[0]?.errors?.[0]?.message || payload?.error?.message || `Google Ads API returned ${response.status}.`;
    throw new Error(String(message).slice(0, 1200));
  }
  return payload;
}

export async function listGoogleAdsCustomers(config: { accessToken: string; developerToken: string; loginCustomerId?: string; apiVersion: string }) {
  const headers: Record<string, string> = { Authorization: `Bearer ${config.accessToken}`, 'developer-token': config.developerToken };
  if (config.loginCustomerId) headers['login-customer-id'] = config.loginCustomerId;
  const response = await fetch(`https://googleads.googleapis.com/${config.apiVersion}/customers:listAccessibleCustomers`, { headers, cache: 'no-store' });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload?.error?.message || `Google Ads customer list failed (${response.status}).`);
  return (payload.resourceNames || []).map((name: string) => normalizeCustomerId(name.split('/').pop())).filter(Boolean);
}

export async function saveWorkspaceGoogleAdsCredentials(db: any, organizationId: string, userId: string, patch: Record<string, unknown>, settingsPatch: Record<string, unknown> = {}) {
  const existing = await db.from('growth_integrations').select('id,encrypted_credentials,settings').eq('organization_id', organizationId).eq('provider', 'google_ads').maybeSingle();
  if (existing.error) throw new Error('Could not read workspace Google Ads integration.');
  let credentials: any = {};
  try { credentials = decryptSecret(existing.data?.encrypted_credentials || '') || {}; } catch { throw new Error('Stored Google Ads credentials cannot be decrypted.'); }
  for (const [key, value] of Object.entries(patch)) if (typeof value === 'string' && value.trim()) credentials[key] = value.trim();
  const settings = { ...(existing.data?.settings || {}), ...settingsPatch };
  const { error } = await db.from('growth_integrations').upsert({ organization_id: organizationId, provider: 'google_ads', display_name: 'Google Ads (Client Account)', encrypted_credentials: encryptSecret(credentials), settings, connection_status: credentials.refresh_token ? 'connected' : 'saved', last_error: null, updated_by: userId, updated_at: new Date().toISOString() }, { onConflict: 'organization_id,provider' });
  if (error) throw new Error('Could not save Google Ads workspace credentials.');
  return { settings, hasRefreshToken: Boolean(credentials.refresh_token) };
}
