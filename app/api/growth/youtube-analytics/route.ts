import { NextRequest } from 'next/server';
import {apiJson, growthContext, requireGrowthRole, requireGrowthFeature} from '@/lib/growth-server';
import { decryptSecret, encryptSecret } from '@/lib/growth-crypto';

export const runtime = 'nodejs';

async function getAccessToken(db: any, account: any, credentials: any) {
  if (credentials?.expires_at && Date.parse(credentials.expires_at) > Date.now() + 60_000) return credentials.access_token;
  if (!credentials?.refresh_token) throw new Error('Refresh token missing. Reconnect YouTube and grant offline access.');
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: process.env.GOOGLE_CLIENT_ID || '', client_secret: process.env.GOOGLE_CLIENT_SECRET || '', refresh_token: credentials.refresh_token, grant_type: 'refresh_token' }),
  });
  const token = await response.json().catch(() => ({}));
  if (!response.ok || !token.access_token) throw new Error(token.error_description || 'Google token refresh failed.');
  const updated = { ...credentials, access_token: token.access_token, expires_at: new Date(Date.now() + Number(token.expires_in || 3600) * 1000).toISOString() };
  const { error } = await db.from('growth_social_accounts').update({ encrypted_credentials: encryptSecret(updated), token_expires_at: updated.expires_at }).eq('id', account.id);
  if (error) throw new Error('Could not persist refreshed Google credentials.');
  return updated.access_token;
}

export async function GET(req: NextRequest) {
  const ctx = await growthContext(req);
  if ('response' in ctx) return ctx.response;
  const organizationId = req.nextUrl.searchParams.get('organizationId') || '';
  const accountId = req.nextUrl.searchParams.get('socialAccountId') || '';
  const days = Number(req.nextUrl.searchParams.get('days') || 28);
  if (!organizationId || !accountId || ![7, 28, 90].includes(days)) return apiJson({ error: 'Organization, YouTube account and a 7, 28 or 90 day period are required.' }, 400);
  if (!await requireGrowthRole(ctx.db, ctx.userId, organizationId, ['owner', 'manager', 'editor', 'viewer'])) return apiJson({ error: 'Workspace permission denied.' }, 403);
 if(!await requireGrowthFeature(ctx.db,ctx.userId,organizationId,'social_channels'))return apiJson({error:'This module is not included in your workspace plan.'},402);
  const { data: account, error } = await ctx.db.from('growth_social_accounts').select('id,platform,connection_status,encrypted_credentials,account_name,scopes').eq('id', accountId).eq('organization_id', organizationId).maybeSingle();
  if (error || !account || account.platform !== 'youtube' || account.connection_status !== 'connected') return apiJson({ error: 'Choose a connected YouTube channel from this workspace.' }, 409);
  if (!(account.scopes || []).includes('https://www.googleapis.com/auth/yt-analytics.readonly')) return apiJson({ error: 'YouTube Analytics permission is missing. Reconnect the channel and approve yt-analytics.readonly.' }, 409);
  try {
    const credentials = decryptSecret(account.encrypted_credentials);
    const accessToken = await getAccessToken(ctx.db, account, credentials);
    const end = new Date(Date.now() - 2 * 86_400_000);
    const start = new Date(end.getTime() - (days - 1) * 86_400_000);
    const fmt = (date: Date) => date.toISOString().slice(0, 10);
    const url = new URL('https://youtubeanalytics.googleapis.com/v2/reports');
    url.searchParams.set('ids', 'channel==MINE');
    url.searchParams.set('startDate', fmt(start));
    url.searchParams.set('endDate', fmt(end));
    url.searchParams.set('metrics', 'views,estimatedMinutesWatched,averageViewDuration,likes,comments,subscribersGained,subscribersLost');
    url.searchParams.set('dimensions', 'day');
    url.searchParams.set('sort', 'day');
    const response = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` }, cache: 'no-store' });
    const report = await response.json().catch(() => ({}));
    if (!response.ok) return apiJson({ error: report.error?.message || `YouTube Analytics request failed (${response.status}).` }, 502);
    const headers = (report.columnHeaders || []).map((h: any) => h.name);
    const rows = (report.rows || []).map((row: any[]) => Object.fromEntries(headers.map((key: string, index: number) => [key, row[index]])));
    const totals = rows.reduce((sum: any, row: any) => {
      for (const key of ['views', 'estimatedMinutesWatched', 'likes', 'comments', 'subscribersGained', 'subscribersLost']) sum[key] = (sum[key] || 0) + Number(row[key] || 0);
      return sum;
    }, { views: 0, estimatedMinutesWatched: 0, likes: 0, comments: 0, subscribersGained: 0, subscribersLost: 0 });
    totals.averageViewDuration = totals.views ? Math.round((totals.estimatedMinutesWatched * 60) / totals.views) : 0;
    return apiJson({ channel: account.account_name, period: { days, startDate: fmt(start), endDate: fmt(end) }, totals, rows, source: 'YouTube Analytics API', fetchedAt: new Date().toISOString() });
  } catch (error) {
    return apiJson({ error: error instanceof Error ? error.message : 'YouTube Analytics could not be loaded.' }, 502);
  }
}
