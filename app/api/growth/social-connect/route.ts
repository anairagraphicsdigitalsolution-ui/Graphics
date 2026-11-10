import { randomBytes } from 'crypto';
import { NextRequest } from 'next/server';
import { apiJson, growthContext, requireGrowthRole, requireGrowthFeature } from '@/lib/growth-server';
import { hashState } from '@/lib/growth-crypto';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const context = await growthContext(req);
  if ('response' in context) return context.response;
  const body = await req.json().catch(() => ({}));
  const organizationId = String(body.organizationId || '');
  const provider = String(body.provider || '').toLowerCase();
  if (!['linkedin', 'youtube'].includes(provider)) return apiJson({ error: 'Choose LinkedIn or YouTube.' }, 400);
  if (!await requireGrowthRole(context.db, context.userId, organizationId, ['owner', 'manager'])) return apiJson({ error: 'Workspace manager permission required.' }, 403);
  if (!await requireGrowthFeature(context.db, context.userId, organizationId, 'social_channels')) return apiJson({ error: 'Social channels are not included in this workspace plan.' }, 402);

  const state = randomBytes(32).toString('hex');
  const redirectUri = provider === 'linkedin' ? process.env.LINKEDIN_REDIRECT_URI : process.env.GOOGLE_REDIRECT_URI;
  const clientId = provider === 'linkedin' ? process.env.LINKEDIN_CLIENT_ID : process.env.GOOGLE_CLIENT_ID;
  if (!redirectUri || !clientId) return apiJson({ error: `${provider === 'linkedin' ? 'LINKEDIN' : 'GOOGLE'}_CLIENT_ID and redirect URI are required.` }, 503);
  const { error } = await context.db.from('growth_oauth_states').insert({ organization_id: organizationId, user_id: context.userId, provider, state_hash: hashState(state), expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString() });
  if (error) return apiJson({ error: 'Could not start secure OAuth session.' }, 500);

  const callback = new URL(`/api/growth/social-callback/${provider}`, process.env.NEXT_PUBLIC_SITE_URL || req.nextUrl.origin).toString();
  if (callback !== redirectUri) return apiJson({ error: `OAuth redirect URI mismatch. Set ${provider === 'linkedin' ? 'LINKEDIN_REDIRECT_URI' : 'GOOGLE_REDIRECT_URI'} to ${callback}` }, 409);
  const auth = provider === 'linkedin' ? new URL('https://www.linkedin.com/oauth/v2/authorization') : new URL('https://accounts.google.com/o/oauth2/v2/auth');
  auth.searchParams.set('client_id', clientId);
  auth.searchParams.set('redirect_uri', redirectUri);
  auth.searchParams.set('response_type', 'code');
  auth.searchParams.set('state', state);
  if (provider === 'linkedin') auth.searchParams.set('scope', 'openid profile w_member_social');
  else {
    auth.searchParams.set('scope', 'openid email profile https://www.googleapis.com/auth/youtube.upload https://www.googleapis.com/auth/youtube.readonly https://www.googleapis.com/auth/yt-analytics.readonly');
    auth.searchParams.set('access_type', 'offline');
    auth.searchParams.set('prompt', 'consent');
  }
  return apiJson({ url: auth.toString() });
}
