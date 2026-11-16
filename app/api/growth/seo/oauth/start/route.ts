import { NextRequest, NextResponse } from 'next/server';
import { randomBytes, createHmac } from 'node:crypto';
import { growthContext, requireGrowthRole, apiJson } from '@/lib/growth-server';
import { decryptSecret } from '@/lib/growth-crypto';

export const runtime = 'nodejs';
const stateSecret = () => process.env.GROWTH_OAUTH_STATE_SECRET || process.env.GROWTH_TOKEN_ENCRYPTION_KEY || '';

export async function POST(req: NextRequest) {
  const ctx = await growthContext(req);
  if ('response' in ctx) return ctx.response;
  try {
    const body = await req.json();
    const organizationId = String(body.organizationId || '');
    if (!await requireGrowthRole(ctx.db, ctx.userId, organizationId, ['owner', 'manager'])) {
      return apiJson({ error: 'Workspace owner or manager permission required.' }, 403);
    }
    const { data: app, error } = await ctx.db.from('growth_platform_integrations')
      .select('encrypted_credentials,settings').eq('provider', 'google_oauth_app').maybeSingle();
    if (error || !app?.encrypted_credentials) return apiJson({ error: 'Configure the Google OAuth Developer App in Anaira Developer APIs first.' }, 409);
    let credentials: any;
    try { credentials = decryptSecret(app.encrypted_credentials) || {}; }
    catch { return apiJson({ error: 'Google OAuth app credentials cannot be decrypted. Check GROWTH_TOKEN_ENCRYPTION_KEY.' }, 503); }
    const clientId = String(credentials.client_id || '').trim();
    const clientSecret = String(credentials.client_secret || '').trim();
    const siteUrl = String(process.env.NEXT_PUBLIC_SITE_URL || process.env.APP_URL || req.nextUrl.origin).replace(/\/$/, '');
    const redirectUri = String(app.settings?.seo_redirect_uri || `${siteUrl}/api/growth/seo/oauth/callback`).trim();
    if (!clientId || !clientSecret || !redirectUri.startsWith('https://')) return apiJson({ error: 'Google OAuth client ID/secret and an HTTPS site URL are required.' }, 409);
    if (!stateSecret()) return apiJson({ error: 'Set GROWTH_OAUTH_STATE_SECRET on the server before starting OAuth.' }, 503);

    const state = randomBytes(32).toString('base64url');
    const payload = Buffer.from(JSON.stringify({ state, organizationId, userId: ctx.userId, exp: Date.now() + 10 * 60 * 1000 })).toString('base64url');
    const signature = createHmac('sha256', stateSecret()).update(payload).digest('base64url');
    const auth = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    auth.searchParams.set('client_id', clientId);
    auth.searchParams.set('redirect_uri', redirectUri);
    auth.searchParams.set('response_type', 'code');
    auth.searchParams.set('scope', [
      'https://www.googleapis.com/auth/webmasters.readonly',
      'https://www.googleapis.com/auth/analytics.readonly',
    ].join(' '));
    auth.searchParams.set('access_type', 'offline');
    auth.searchParams.set('prompt', 'consent');
    auth.searchParams.set('include_granted_scopes', 'true');
    auth.searchParams.set('state', state);
    const response = NextResponse.json({ authUrl: auth.toString() });
    response.cookies.set('growth_seo_oauth', `${payload}.${signature}`, {
      httpOnly: true, secure: true, sameSite: 'lax', path: '/api/growth/seo/oauth/callback', maxAge: 600,
    });
    return response;
  } catch (error) {
    return apiJson({ error: error instanceof Error ? error.message : 'Could not start SEO OAuth.' }, 400);
  }
}
