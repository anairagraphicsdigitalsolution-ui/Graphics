import { NextRequest, NextResponse } from 'next/server';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { readWorkspaceGoogleAdsOAuthConfig, saveWorkspaceGoogleAdsCredentials, listGoogleAdsCustomers } from '@/lib/growth-google-ads';
export const runtime = 'nodejs';
const secret = () => process.env.GROWTH_OAUTH_STATE_SECRET || process.env.GROWTH_TOKEN_ENCRYPTION_KEY || '';
function redirect(req: NextRequest, path: string) { return NextResponse.redirect(new URL(path, req.nextUrl.origin)); }
export async function GET(req: NextRequest) {
  const cookie = req.cookies.get('growth_google_ads_oauth')?.value || '';
  const clear = (res: NextResponse) => { res.cookies.set('growth_google_ads_oauth', '', { httpOnly: true, secure: req.nextUrl.protocol === 'https:', sameSite: 'lax', path: '/api/growth/google-ads/oauth/callback', maxAge: 0 }); return res; };
  try {
    const [payload, signature] = cookie.split('.'); if (!payload || !signature || !secret()) throw new Error('OAuth session expired. Start Google Ads connection again.');
    const expected = createHmac('sha256', secret()).update(payload).digest(); const received = Buffer.from(signature, 'base64url');
    if (received.length !== expected.length || !timingSafeEqual(received, expected)) throw new Error('OAuth state signature is invalid.');
    const state = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (state.exp < Date.now() || state.state !== req.nextUrl.searchParams.get('state')) throw new Error('OAuth state expired or does not match this browser session.');
    const organizationId = String(state.organizationId || ''), userId = String(state.userId || '');
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL; const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !service || !organizationId || !userId) throw new Error('Server authentication configuration is incomplete.');
    const db = createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } });
    const [{ data: organization }, { data: member }, { data: admin }] = await Promise.all([
      db.from('growth_organizations').select('id,status').eq('id', organizationId).maybeSingle(),
      db.from('growth_members').select('role').eq('organization_id', organizationId).eq('user_id', userId).maybeSingle(),
      db.from('admin_users').select('user_id').eq('user_id', userId).maybeSingle(),
    ]);
    if (!organization || organization.status !== 'active' || (!['owner','manager'].includes(String(member?.role || '')) && !admin?.user_id)) throw new Error('Workspace permission changed during OAuth. Sign in and reconnect.');
    const providerError = req.nextUrl.searchParams.get('error'); if (providerError) throw new Error(`Google authorization was not completed: ${providerError}`);
    const code = req.nextUrl.searchParams.get('code') || ''; if (!code) throw new Error('Google did not return an authorization code.');
    const config = await readWorkspaceGoogleAdsOAuthConfig(db, organizationId);
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ code, client_id: config.clientId, client_secret: config.clientSecret, redirect_uri: config.redirectUri, grant_type: 'authorization_code' }), cache: 'no-store' });
    const token = await tokenResponse.json().catch(() => ({})); if (!tokenResponse.ok || !token.refresh_token) throw new Error(token.error_description || 'Google did not issue an offline refresh token. Revoke the app and reconnect with consent.');
    await saveWorkspaceGoogleAdsCredentials(db, organizationId, userId, { refresh_token: String(token.refresh_token), access_token: String(token.access_token || '') });
    const customers = await listGoogleAdsCustomers({ accessToken: String(token.access_token), developerToken: config.developerToken, loginCustomerId: config.loginCustomerId, apiVersion: config.apiVersion });
    if (customers.length) await saveWorkspaceGoogleAdsCredentials(db, organizationId, userId, {}, { accessible_customer_ids: customers });
    return clear(redirect(req, `/admin/ai-growth/google-ads?connected=1&accounts=${customers.length}`));
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Google Ads OAuth failed.';
    return clear(redirect(req, `/admin/ai-growth/google-ads?error=${encodeURIComponent(message.slice(0,180))}`));
  }
}
