import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { encryptSecret, hashState } from '@/lib/growth-crypto';

export const runtime = 'nodejs';
const fail = (message: string) => NextResponse.redirect(new URL(`/admin/ai-growth?integration_error=${encodeURIComponent(message)}`, process.env.NEXT_PUBLIC_SITE_URL || 'https://anairagraphics.com'));

export async function GET(req: NextRequest, { params }: { params: Promise<{ provider: string }> }) {
  const { provider } = await params;
  if (!['linkedin', 'youtube'].includes(provider)) return fail('Unsupported social provider.');
  const p = req.nextUrl.searchParams;
  const code = p.get('code');
  const state = p.get('state');
  if (p.get('error') || !code || !state) return fail('Authorization was cancelled or incomplete.');
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const clientId = provider === 'linkedin' ? process.env.LINKEDIN_CLIENT_ID : process.env.GOOGLE_CLIENT_ID;
  const clientSecret = provider === 'linkedin' ? process.env.LINKEDIN_CLIENT_SECRET : process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = provider === 'linkedin' ? process.env.LINKEDIN_REDIRECT_URI : process.env.GOOGLE_REDIRECT_URI;
  if (!url || !service || !clientId || !clientSecret || !redirectUri) return fail('OAuth server credentials are incomplete.');

  try {
    const db = createClient(url, service, { auth: { persistSession: false } });
    const { data: oauth } = await db.from('growth_oauth_states').select('*').eq('state_hash', hashState(state)).eq('provider', provider).is('used_at', null).gt('expires_at', new Date().toISOString()).maybeSingle();
    if (!oauth) return fail('OAuth state expired or already used. Restart connection.');
    const { data: claimed } = await db.from('growth_oauth_states').update({ used_at: new Date().toISOString() }).eq('id', oauth.id).is('used_at', null).select('id').maybeSingle();
    if (!claimed) return fail('OAuth state has already been used. Restart connection.');

    const tokenEndpoint = provider === 'linkedin' ? 'https://www.linkedin.com/oauth/v2/accessToken' : 'https://oauth2.googleapis.com/token';
    const tokenResponse = await fetch(tokenEndpoint, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'authorization_code', code, redirect_uri: redirectUri, client_id: clientId, client_secret: clientSecret }) });
    const token = await tokenResponse.json();
    if (!tokenResponse.ok || !token.access_token) throw new Error(token.error_description || token.error || 'OAuth token exchange failed.');

    let externalId = '';
    let accountName = '';
    let metadata: Record<string, unknown> = { connected_at: new Date().toISOString() };
    if (provider === 'linkedin') {
      const profileResponse = await fetch('https://api.linkedin.com/v2/userinfo', { headers: { Authorization: `Bearer ${token.access_token}` }, cache: 'no-store' });
      const profile = await profileResponse.json();
      if (!profileResponse.ok || !profile.sub) throw new Error('LinkedIn profile lookup failed. Ensure openid/profile scopes are approved.');
      externalId = String(profile.sub);
      accountName = String(profile.name || profile.given_name || 'LinkedIn Member');
      metadata = { ...metadata, email: profile.email || null, picture: profile.picture || null };
    } else {
      const channelsResponse = await fetch('https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true', { headers: { Authorization: `Bearer ${token.access_token}` }, cache: 'no-store' });
      const channels = await channelsResponse.json();
      if (!channelsResponse.ok || !channels.items?.[0]?.id) throw new Error(channels.error?.message || 'No YouTube channel was returned for this Google account.');
      externalId = String(channels.items[0].id);
      accountName = String(channels.items[0].snippet?.title || 'YouTube Channel');
      metadata = { ...metadata, thumbnail: channels.items[0].snippet?.thumbnails?.default?.url || null, refresh_token_available: Boolean(token.refresh_token) };
    }

    const encrypted = encryptSecret({ access_token: token.access_token, refresh_token: token.refresh_token || null, token_type: token.token_type || 'Bearer', scope: token.scope || '', expires_at: token.expires_in ? new Date(Date.now() + Number(token.expires_in) * 1000).toISOString() : null, external_id: externalId });
    const { data: existing } = await db.from('growth_social_accounts').select('id').eq('organization_id', oauth.organization_id).eq('platform', provider).eq('external_account_id', externalId).maybeSingle();
    const row = { organization_id: oauth.organization_id, platform: provider, account_name: accountName, external_account_id: externalId, connection_status: 'connected', encrypted_credentials: encrypted, token_expires_at: token.expires_in ? new Date(Date.now() + Number(token.expires_in) * 1000).toISOString() : null, scopes: String(token.scope || '').split(' ').filter(Boolean), metadata };
    const saved = existing ? await db.from('growth_social_accounts').update(row).eq('id', existing.id) : await db.from('growth_social_accounts').insert(row);
    if (saved.error) throw new Error('Provider connected, but account credentials could not be saved. Check the latest social account migration.');
    return NextResponse.redirect(new URL(`/admin/ai-growth?integration=${provider}_connected`, process.env.NEXT_PUBLIC_SITE_URL || 'https://anairagraphics.com'));
  } catch (error) {
    return fail(error instanceof Error ? error.message : 'Social account connection failed.');
  }
}
