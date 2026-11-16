import { NextRequest, NextResponse } from 'next/server';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { decryptSecret, encryptSecret } from '@/lib/growth-crypto';

export const runtime = 'nodejs';
const stateSecret = () => process.env.GROWTH_OAUTH_STATE_SECRET || process.env.GROWTH_TOKEN_ENCRYPTION_KEY || '';
function redirect(req: NextRequest, query: string) { return NextResponse.redirect(new URL(`/admin/ai-growth/website-intelligence${query}`, req.nextUrl.origin)); }

export async function GET(req: NextRequest) {
  const cookie = req.cookies.get('growth_seo_oauth')?.value || '';
  const clear = (response: NextResponse) => {
    response.cookies.set('growth_seo_oauth', '', { httpOnly: true, secure: true, sameSite: 'lax', path: '/api/growth/seo/oauth/callback', maxAge: 0 });
    return response;
  };
  try {
    const [payload, signature] = cookie.split('.');
    if (!payload || !signature || !stateSecret()) throw new Error('SEO OAuth session expired. Start Google connection again.');
    const expected = createHmac('sha256', stateSecret()).update(payload).digest();
    const received = Buffer.from(signature, 'base64url');
    if (received.length !== expected.length || !timingSafeEqual(received, expected)) throw new Error('SEO OAuth state signature is invalid.');
    const state = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (state.exp < Date.now() || state.state !== req.nextUrl.searchParams.get('state')) throw new Error('SEO OAuth state expired or does not match this browser session.');
    const organizationId = String(state.organizationId || ''), userId = String(state.userId || '');
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !service || !organizationId || !userId) throw new Error('Server authentication configuration is incomplete.');
    const db = createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } });
    const [{ data: organization }, { data: member }, { data: admin }] = await Promise.all([
      db.from('growth_organizations').select('id,status').eq('id', organizationId).maybeSingle(),
      db.from('growth_members').select('role').eq('organization_id', organizationId).eq('user_id', userId).maybeSingle(),
      db.from('admin_users').select('user_id').eq('user_id', userId).maybeSingle(),
    ]);
    if (!organization || organization.status !== 'active' || (!['owner', 'manager'].includes(String(member?.role || '')) && !admin?.user_id)) throw new Error('Workspace permission changed during OAuth. Sign in and reconnect.');
    const providerError = req.nextUrl.searchParams.get('error');
    if (providerError) throw new Error(`Google authorization was not completed: ${providerError}`);
    const code = req.nextUrl.searchParams.get('code') || '';
    if (!code) throw new Error('Google did not return an authorization code.');
    const { data: app, error: appError } = await db.from('growth_platform_integrations').select('encrypted_credentials,settings').eq('provider', 'google_oauth_app').maybeSingle();
    if (appError || !app?.encrypted_credentials) throw new Error('Google OAuth Developer App is not configured.');
    const appCredentials: any = decryptSecret(app.encrypted_credentials) || {};
    const siteUrl = String(process.env.NEXT_PUBLIC_SITE_URL || process.env.APP_URL || req.nextUrl.origin).replace(/\/$/, '');
    const redirectUri = String(app.settings?.seo_redirect_uri || `${siteUrl}/api/growth/seo/oauth/callback`).trim();
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ code, client_id: String(appCredentials.client_id || ''), client_secret: String(appCredentials.client_secret || ''), redirect_uri: redirectUri, grant_type: 'authorization_code' }),
      cache: 'no-store',
    });
    const token: any = await tokenResponse.json().catch(() => ({}));
    if (!tokenResponse.ok || !token.access_token) throw new Error(token.error_description || token.error || 'Google authorization code exchange failed.');
    const { data: old, error: oldError } = await db.from('growth_integrations').select('id,encrypted_credentials,settings').eq('organization_id', organizationId).eq('provider', 'google_seo').maybeSingle();
    if (oldError) throw new Error('Could not read existing Google SEO connection.');
    let previous: any = {};
    if (old?.encrypted_credentials) previous = decryptSecret(old.encrypted_credentials) || {};
    const refreshToken = String(token.refresh_token || previous.refresh_token || '');
    if (!refreshToken) throw new Error('Google did not issue an offline refresh token. Revoke this app in your Google Account and reconnect with consent.');
    const scopes = String(token.scope || previous.granted_scopes?.join(' ') || '').split(' ').filter(Boolean);
    const credentials = { ...previous, refresh_token: refreshToken, granted_scopes: scopes, connected_at: new Date().toISOString() };
    const { error: saveError } = await db.from('growth_integrations').upsert({
      organization_id: organizationId, provider: 'google_seo', display_name: 'Google Search Console + Analytics',
      encrypted_credentials: encryptSecret(credentials), settings: old?.settings || {}, connection_status: 'connected',
      last_error: null, updated_by: userId, updated_at: new Date().toISOString(), last_success_at: new Date().toISOString(),
    }, { onConflict: 'organization_id,provider' });
    if (saveError) throw new Error('Could not securely save the Google SEO refresh token.');
    return clear(redirect(req, '?google_seo=connected'));
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Google SEO OAuth failed.';
    return clear(redirect(req, `?google_seo_error=${encodeURIComponent(message.slice(0, 160))}`));
  }
}
