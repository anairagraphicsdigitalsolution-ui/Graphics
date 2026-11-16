import { NextRequest } from 'next/server';
import { apiJson, growthContext, requireGrowthFeature, requireGrowthRole } from '@/lib/growth-server';
import { getWorkspaceAccessToken } from '@/lib/growth-integrations';

export const runtime = 'nodejs';
const clean = (row: any) => ({
  id: row.id, platform: row.platform, account_name: row.account_name,
  external_account_id: row.external_account_id, connection_status: row.connection_status,
  token_expires_at: row.token_expires_at, token_health: row.token_health || 'unknown',
  scopes: row.scopes || [], last_synced_at: row.last_synced_at,
  last_health_check_at: row.last_health_check_at, last_error: row.last_error,
  last_error_at: row.last_error_at, last_error_code: row.last_error_code,
  provider_profile_url: row.provider_profile_url, metadata: row.metadata || {},
});

export async function GET(req: NextRequest) {
  const ctx = await growthContext(req); if ('response' in ctx) return ctx.response;
  const organizationId = req.nextUrl.searchParams.get('organizationId') || '';
  if (!await requireGrowthRole(ctx.db, ctx.userId, organizationId, ['owner','manager','editor','viewer'])) return apiJson({ error: 'Workspace permission denied.' }, 403);
  if (!await requireGrowthFeature(ctx.db, ctx.userId, organizationId, 'social_channels')) return apiJson({ error: 'Social channels are not included in this workspace plan.' }, 402);
  const { data, error } = await ctx.db.from('growth_social_accounts')
    .select('id,platform,account_name,external_account_id,connection_status,token_expires_at,token_health,scopes,last_synced_at,last_health_check_at,last_error,last_error_at,last_error_code,provider_profile_url,metadata')
    .eq('organization_id', organizationId).order('created_at', { ascending: false }).limit(100);
  if (error) return apiJson({ error: 'Connected social accounts could not be loaded. Apply the Module 6 migration.' }, 500);
  const accounts = (data || []).map(clean);
  return apiJson({ accounts, summary: {
    total: accounts.length,
    connected: accounts.filter((x: any) => x.connection_status === 'connected').length,
    attention: accounts.filter((x: any) => ['expired','error'].includes(x.token_health) || x.connection_status !== 'connected').length,
  }});
}

export async function POST(req: NextRequest) {
  const ctx = await growthContext(req); if ('response' in ctx) return ctx.response;
  try {
    const body = await req.json();
    const organizationId = String(body.organizationId || ''), accountId = String(body.accountId || ''), action = String(body.action || 'health_check');
    if (!organizationId || !accountId || !['health_check','refresh','disconnect'].includes(action)) return apiJson({ error: 'Organization, account and a supported action are required.' }, 400);
    if (!await requireGrowthRole(ctx.db, ctx.userId, organizationId, ['owner','manager'])) return apiJson({ error: 'Workspace manager permission required.' }, 403);
    if (!await requireGrowthFeature(ctx.db, ctx.userId, organizationId, 'social_channels')) return apiJson({ error: 'Social channels are not included in this workspace plan.' }, 402);
    const { data: account, error } = await ctx.db.from('growth_social_accounts').select('id,platform,account_name,external_account_id,connection_status,token_expires_at,encrypted_credentials,metadata').eq('id', accountId).eq('organization_id', organizationId).maybeSingle();
    if (error || !account) return apiJson({ error: 'Social account not found in this workspace.' }, 404);
    if (action === 'disconnect') {
      const { error: updateError } = await ctx.db.from('growth_social_accounts').update({ connection_status: 'not_connected', encrypted_credentials: null, token_health: 'unknown', last_error: null, last_error_code: null }).eq('id', accountId).eq('organization_id', organizationId);
      if (updateError) return apiJson({ error: 'Account could not be disconnected.' }, 500);
      return apiJson({ success: true, message: `${account.platform} account disconnected.` });
    }
    if (account.connection_status !== 'connected') return apiJson({error:'This account is not connected. Reconnect it before checking or refreshing.'},409);
    if (!['facebook','instagram','linkedin','youtube'].includes(account.platform) || !account.external_account_id) return apiJson({error:'This account does not have a supported provider identity.'},422);
    try {
      const token = await getWorkspaceAccessToken(ctx.db, organizationId, account.platform === 'facebook' ? 'meta' : account.platform === 'instagram' ? 'instagram' : account.platform === 'youtube' ? 'youtube' : 'linkedin', account.external_account_id || undefined);
      let profile: any = {};
      if (account.platform === 'facebook') {
        const version = process.env.META_GRAPH_API_VERSION || 'v22.0';
        const u = new URL(`https://graph.facebook.com/${version}/${encodeURIComponent(account.external_account_id)}`);
        u.searchParams.set('fields', 'id,name,username,link'); u.searchParams.set('access_token', token);
        const r = await fetch(u, { cache: 'no-store', signal: AbortSignal.timeout(15000) }); profile = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(profile?.error?.message || `Facebook health check failed (${r.status}).`);
      } else if (account.platform === 'instagram') {
        const version = process.env.META_GRAPH_API_VERSION || 'v22.0';
        const u = new URL(`https://graph.facebook.com/${version}/${encodeURIComponent(account.external_account_id)}`);
        u.searchParams.set('fields', 'id,username,name,profile_picture_url,followers_count,media_count'); u.searchParams.set('access_token', token);
        const r = await fetch(u, { cache: 'no-store', signal: AbortSignal.timeout(15000) }); profile = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(profile?.error?.message || `Instagram health check failed (${r.status}).`);
      } else if (account.platform === 'linkedin') {
        const r = await fetch('https://api.linkedin.com/v2/userinfo', { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store', signal: AbortSignal.timeout(15000) }); profile = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(profile?.message || `LinkedIn health check failed (${r.status}).`);
      } else if (account.platform === 'youtube') {
        const r = await fetch('https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&mine=true', { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store', signal: AbortSignal.timeout(15000) });
        const data = await r.json().catch(() => ({})); if (!r.ok || !data.items?.[0]) throw new Error(data?.error?.message || `YouTube health check failed (${r.status}).`);
        profile = { id: data.items[0].id, title: data.items[0].snippet?.title, customUrl: data.items[0].snippet?.customUrl, statistics: data.items[0].statistics };
      } else throw new Error('Unsupported social platform.');
      const now = new Date().toISOString();
      const { data: refreshedAccount } = await ctx.db.from('growth_social_accounts').select('token_expires_at').eq('id', accountId).eq('organization_id', organizationId).maybeSingle();
      const expires = refreshedAccount?.token_expires_at ? Date.parse(refreshedAccount.token_expires_at) : 0;
      const health = expires && expires < Date.now() ? 'expired' : expires && expires < Date.now() + 7 * 86400000 ? 'expiring' : 'healthy';
      const profileUrl = account.platform === 'youtube' ? (profile.customUrl ? `https://www.youtube.com/${profile.customUrl}` : null) : account.platform === 'linkedin' ? (profile.sub ? null : null) : profile.link || null;
      const { error: saveError } = await ctx.db.from('growth_social_accounts').update({
        token_health: health, last_health_check_at: now, last_error: null, last_error_code: null,
        provider_profile_url: profileUrl,
        account_name: String(profile.name || profile.username || profile.title || account.account_name).slice(0, 180),
        metadata: { ...(account.metadata || {}), profile_summary: { username: profile.username || null, followers_count: profile.followers_count ?? null, media_count: profile.media_count ?? null, statistics: profile.statistics || null }, last_health_check_at: now },
      }).eq('id', accountId).eq('organization_id', organizationId);
      if (saveError) throw new Error('Provider connection was checked but account health could not be saved.');
      return apiJson({ success: true, action, health, accountId, profile: { name: profile.name || profile.username || profile.title || account.account_name, url: profileUrl } });
    } catch (providerError) {
      const message = providerError instanceof Error ? providerError.message.slice(0, 500) : 'Provider health check failed.';
      const expired = /expired|invalid.*token|oauth.*token|token.*invalid|re-auth|invalid_grant|error validating access token|code 190/i.test(message);
      await ctx.db.from('growth_social_accounts').update({ token_health: expired ? 'expired' : 'error', connection_status: expired ? 'expired' : account.connection_status, last_error: message, last_error_code: expired ? 'TOKEN_INVALID' : 'PROVIDER_HEALTH_CHECK_FAILED', last_error_at: new Date().toISOString(), last_health_check_at: new Date().toISOString() }).eq('id', accountId).eq('organization_id', organizationId);
      return apiJson({ error: message, health: expired ? 'expired' : 'error', reconnectRequired: expired }, 502);
    }
  } catch (error) { return apiJson({ error: error instanceof Error ? error.message : 'Social account action failed.' }, 400); }
}
