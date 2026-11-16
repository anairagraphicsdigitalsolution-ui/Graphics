import { NextRequest, NextResponse } from 'next/server';
import { randomBytes, createHmac } from 'node:crypto';
import { growthContext, requireGrowthRole, apiJson } from '@/lib/growth-server';
import { readWorkspaceGoogleAdsOAuthConfig } from '@/lib/growth-google-ads';
export const runtime = 'nodejs';
const secret = () => process.env.GROWTH_OAUTH_STATE_SECRET || process.env.GROWTH_TOKEN_ENCRYPTION_KEY || '';
async function begin(req: NextRequest, asJson = false) {
  const ctx = await growthContext(req); if ('response' in ctx) return ctx.response;
  let posted: any = {}; if (req.method === 'POST') { try { posted = await req.json(); } catch {} }
  const organizationId = req.nextUrl.searchParams.get('organizationId') || String(posted.organizationId || '');
  if (!await requireGrowthRole(ctx.db, ctx.userId, organizationId, ['owner','manager'])) return apiJson({ error: 'Workspace owner or manager permission required.' }, 403);
  const config = await readWorkspaceGoogleAdsOAuthConfig(ctx.db, organizationId);
  if (!config.clientId || !config.clientSecret || !config.developerToken || !config.redirectUri.startsWith('https://')) return apiJson({ error: 'Configure Anaira Google OAuth App, HTTPS callback URL and Google Ads Developer Token in Anaira Developer APIs first.' }, 409);
  if (!secret()) return apiJson({ error: 'Set GROWTH_OAUTH_STATE_SECRET on the server before starting OAuth.' }, 503);
  const state = randomBytes(32).toString('base64url');
  const payload = Buffer.from(JSON.stringify({ state, organizationId, userId: ctx.userId, exp: Date.now() + 10 * 60 * 1000 })).toString('base64url');
  const signature = createHmac('sha256', secret()).update(payload).digest('base64url');
  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  url.searchParams.set('client_id', config.clientId); url.searchParams.set('redirect_uri', config.redirectUri);
  url.searchParams.set('response_type', 'code'); url.searchParams.set('scope', 'https://www.googleapis.com/auth/adwords');
  url.searchParams.set('access_type', 'offline'); url.searchParams.set('prompt', 'consent'); url.searchParams.set('include_granted_scopes', 'true'); url.searchParams.set('state', state);
  const response = asJson ? NextResponse.json({ authUrl: url.toString() }) : NextResponse.redirect(url);
  response.cookies.set('growth_google_ads_oauth', `${payload}.${signature}`, { httpOnly: true, secure: req.nextUrl.protocol === 'https:', sameSite: 'lax', path: '/api/growth/google-ads/oauth/callback', maxAge: 600 });
  return response;
}
export async function GET(req: NextRequest) { return begin(req, false); }
export async function POST(req: NextRequest) { return begin(req, true); }
