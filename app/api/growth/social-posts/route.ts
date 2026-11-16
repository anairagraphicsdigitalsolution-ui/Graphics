import { NextRequest } from 'next/server';
import { apiJson, growthContext, requireGrowthFeature, requireGrowthRole } from '@/lib/growth-server';
import { getWorkspaceAccessToken } from '@/lib/growth-integrations';
export const runtime = 'nodejs';

function bestTimes(rows: any[]) {
  const buckets = new Map<string, { weekday: number; hour: number; total: number; count: number; engagement: number }>();
  for (const row of rows) {
    if (!row.published_at) continue;
    const date = new Date(row.published_at); if (!Number.isFinite(date.getTime())) continue;
    const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Kolkata', weekday: 'short', hour: '2-digit', hourCycle: 'h23' }).formatToParts(date);
    const weekday = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].indexOf(parts.find(x => x.type === 'weekday')?.value || '');
    const hour = Number(parts.find(x => x.type === 'hour')?.value || 0);
    const key = `${weekday}-${hour}`; const metrics = row.metrics || {};
    const engagement = Number(metrics.engagement ?? (Number(metrics.likes || 0) + Number(metrics.comments || 0) + Number(metrics.shares || 0)));
    const current = buckets.get(key) || { weekday, hour, total: 0, count: 0, engagement: 0 };
    current.total += engagement; current.count += 1; current.engagement = current.total / current.count; buckets.set(key, current);
  }
  return [...buckets.values()].filter(x => x.count >= 2).sort((a,b) => b.engagement-a.engagement).slice(0,3).map(x => ({ weekday: ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][x.weekday], hour: x.hour, label: `${['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][x.weekday]} ${String(x.hour).padStart(2,'0')}:00–${String((x.hour+1)%24).padStart(2,'0')}:00 IST`, averageEngagement: Math.round(x.engagement*100)/100, sampleSize: x.count }));
}

export async function GET(req: NextRequest) {
  const ctx = await growthContext(req); if ('response' in ctx) return ctx.response;
  const organizationId = req.nextUrl.searchParams.get('organizationId') || '';
  if (!await requireGrowthRole(ctx.db, ctx.userId, organizationId, ['owner','manager','editor','viewer'])) return apiJson({ error: 'Workspace permission denied.' },403);
  if (!await requireGrowthFeature(ctx.db, ctx.userId, organizationId, 'social_channels')) return apiJson({ error: 'Social channels are not included in this workspace plan.' },402);
  const accountId = req.nextUrl.searchParams.get('accountId') || '';
  let query = ctx.db.from('growth_social_posts').select('id,social_account_id,platform,provider_post_id,permalink,message,published_at,metrics,fetched_at').eq('organization_id',organizationId).order('published_at',{ascending:false,nullsFirst:false}).limit(200);
  if (accountId) { const {data:account} = await ctx.db.from('growth_social_accounts').select('id').eq('id',accountId).eq('organization_id',organizationId).maybeSingle(); if (!account) return apiJson({error:'Social account not found in this workspace.'},404); query = query.eq('social_account_id',accountId); }
  const { data, error } = await query;
  if (error) return apiJson({ error: 'Social post history unavailable. Apply Module 6 migration.' },500);
  const posts = data || [];
  return apiJson({ posts, bestTimes: bestTimes(posts), recommendationBasis: posts.length >= 6 ? 'Observed engagement from synced posts; times shown in Asia/Kolkata.' : 'Not enough synced post history yet. Sync more posts to calculate account-specific recommendations.' });
}

export async function POST(req: NextRequest) {
  const ctx = await growthContext(req); if ('response' in ctx) return ctx.response;
  try {
    const body = await req.json(), organizationId = String(body.organizationId || ''), accountId = String(body.accountId || '');
    if (!organizationId || !accountId) return apiJson({ error: 'Organization and social account are required.' },400);
    if (!await requireGrowthRole(ctx.db,ctx.userId,organizationId,['owner','manager'])) return apiJson({ error: 'Workspace manager permission required.' },403);
    if (!await requireGrowthFeature(ctx.db,ctx.userId,organizationId,'social_channels')) return apiJson({ error: 'Social channels are not included in this workspace plan.' },402);
    const { data: account } = await ctx.db.from('growth_social_accounts').select('id,platform,external_account_id,connection_status').eq('id',accountId).eq('organization_id',organizationId).maybeSingle();
    if (!account || account.connection_status !== 'connected' || !account.external_account_id) return apiJson({ error: 'Choose a connected account with a provider identity from this workspace.' },409);
    if (!['facebook','instagram'].includes(account.platform)) return apiJson({ error: 'Post-level sync currently supports Facebook Pages and Instagram Professional accounts. LinkedIn and YouTube account health/OAuth remain available.' },422);
    const requiredScope = account.platform === 'facebook' ? 'pages_read_engagement' : 'instagram_basic';
    const {data:scopeRow} = await ctx.db.from('growth_social_accounts').select('scopes').eq('id',account.id).eq('organization_id',organizationId).maybeSingle();
    if (!Array.isArray(scopeRow?.scopes) || !scopeRow.scopes.includes(requiredScope)) return apiJson({error:`This account is missing ${requiredScope}. Reconnect Meta and grant the permission before syncing posts.`},403);
    const token = await getWorkspaceAccessToken(ctx.db,organizationId,account.platform === 'instagram' ? 'instagram' : 'meta',account.external_account_id);
    const version = process.env.META_GRAPH_API_VERSION || 'v22.0';
    const endpoint = account.platform === 'facebook' ? `${account.external_account_id}/posts` : `${account.external_account_id}/media`;
    const url = new URL(`https://graph.facebook.com/${version}/${endpoint}`);
    url.searchParams.set('limit','50');
    url.searchParams.set('fields', account.platform === 'facebook' ? 'id,message,created_time,permalink_url,shares,comments.summary(true),likes.summary(true)' : 'id,caption,timestamp,permalink,media_type,like_count,comments_count');
    url.searchParams.set('access_token',token);
    const response = await fetch(url,{cache:'no-store',signal:AbortSignal.timeout(20000)}), payload:any = await response.json().catch(()=>({}));
    if (!response.ok) throw new Error(payload?.error?.message || `Meta post sync failed (${response.status}).`);
    const records = (payload.data || []).map((post:any) => {
      const metrics = account.platform === 'facebook'
        ? { likes: Number(post.likes?.summary?.total_count || 0), comments: Number(post.comments?.summary?.total_count || 0), shares: Number(post.shares?.count || 0), engagement: Number(post.likes?.summary?.total_count || 0) + Number(post.comments?.summary?.total_count || 0) + Number(post.shares?.count || 0) }
        : { likes: Number(post.like_count || 0), comments: Number(post.comments_count || 0), shares: 0, engagement: Number(post.like_count || 0) + Number(post.comments_count || 0), media_type: post.media_type || null };
      return { organization_id: organizationId, social_account_id: account.id, platform: account.platform, provider_post_id: String(post.id), permalink: post.permalink_url || post.permalink || null, message: String(post.message || post.caption || '').slice(0,5000), published_at: post.created_time || post.timestamp || null, metrics, provider_metadata: { media_type: post.media_type || null }, fetched_at: new Date().toISOString(), updated_at: new Date().toISOString() };
    });
    if (records.length) {
      const { error } = await ctx.db.from('growth_social_posts').upsert(records,{onConflict:'social_account_id,provider_post_id'});
      if (error) throw new Error('Provider posts fetched but could not be saved to the workspace.');
    }
    await ctx.db.from('growth_social_accounts').update({ last_synced_at: new Date().toISOString(), last_error: null }).eq('id',account.id).eq('organization_id',organizationId);
    return apiJson({ success:true, accountId, platform:account.platform, fetched:records.length, pagingAvailable:Boolean(payload.paging?.next), note:records.length ? 'Latest posts and engagement counters synced.' : 'Provider returned no posts for this account.' });
  } catch (error) { return apiJson({ error: error instanceof Error ? error.message : 'Social post sync failed.' },502); }
}
