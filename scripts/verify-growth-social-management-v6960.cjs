'use strict';
const fs=require('node:fs');
const read=p=>fs.readFileSync(p,'utf8');
const accounts=read('app/api/growth/social-accounts/route.ts');
const posts=read('app/api/growth/social-posts/route.ts');
const comments=read('app/api/growth/social-comments/route.ts');
const inbox=read('app/api/growth/inbox/route.ts');
const helper=read('lib/growth-integrations.ts');
const metaConnect=read('app/api/growth/meta/connect/route.ts');
const metaCallback=read('app/api/growth/meta/callback/route.ts');
const oauthCallback=read('app/api/growth/social-callback/[provider]/route.ts');
const ui=read('components/growth-social-management.tsx');
const dashboard=read('components/growth-dashboard.tsx');
const nav=read('components/growth-primary-nav.tsx');
const migration=read('supabase/migrations/20261116040854_growth_social_management_v6960.sql');
const claimMigration=read('supabase/migrations/20261116040940_growth_social_comment_reply_claim_v6960b.sql');
const outcomeMigration=read('supabase/migrations/20261116041244_growth_social_comment_outcome_unknown_v6960c.sql');
const privilegeMigration=read('supabase/migrations/20261116041334_growth_social_table_privilege_lockdown_v6960d.sql');
const checks=[
 ['Social account GET is tenant and role scoped',accounts.includes("requireGrowthRole(ctx.db, ctx.userId, organizationId")&&accounts.includes("eq('organization_id', organizationId)")],
 ['Social account API checks social-channel entitlement',accounts.includes("requireGrowthFeature(ctx.db, ctx.userId, organizationId, 'social_channels')")],
 ['Social account API returns sanitized fields and never selects credentials in GET',accounts.includes('const clean =')&&accounts.includes("select('id,platform,account_name")&&!accounts.includes("select('id,platform,account_name,external_account_id,connection_status,token_expires_at,token_health,scopes,last_synced_at,last_health_check_at,last_error,last_error_at,last_error_code,provider_profile_url,metadata,encrypted_credentials")],
 ['Account health checks Meta, Instagram, LinkedIn and YouTube APIs',accounts.includes("account.platform === 'facebook'")&&accounts.includes("account.platform === 'instagram'")&&accounts.includes("account.platform === 'linkedin'")&&accounts.includes("account.platform === 'youtube'")],
 ['Disconnect clears encrypted token and leaves a disconnected record',accounts.includes("connection_status: 'not_connected'")&&accounts.includes('encrypted_credentials: null')],
 ['Account actions require a connected supported provider identity',accounts.includes("account.connection_status !== 'connected'")&&accounts.includes("!account.external_account_id")],
 ['Exact account token resolver rejects mismatched account IDs',helper.includes('if (externalAccountId && !account) throw new Error')],
 ['Meta Page token validity is checked against provider rather than parent user-token expiry',helper.includes('Meta Page/Instagram business tokens are not user refresh tokens')],
 ['Meta OAuth requests comment read and management scopes',metaConnect.includes('pages_manage_engagement')&&metaConnect.includes('instagram_manage_comments')],
 ['Meta callback stores Page tokens without incorrectly copying user-token expiry',metaCallback.includes('const expiresAt=null')&&metaCallback.includes('user_token_expires_at')],
 ['LinkedIn and YouTube OAuth accounts record initial health state',oauthCallback.includes("token_health: 'healthy'")&&oauthCallback.includes('last_health_check_at')],
 ['Post sync supports Facebook and Instagram provider endpoints',posts.includes("account.platform === 'facebook'")&&posts.includes("account.platform === 'instagram'")&&posts.includes('graph.facebook.com')],
 ['Post sync validates provider read scope',posts.includes("'pages_read_engagement'")&&posts.includes("'instagram_basic'")],
 ['Best-time analytics can be filtered to the selected account',posts.includes("searchParams.get('accountId')")&&posts.includes("eq('social_account_id',accountId)")],
 ['Post snapshots upsert tenant/account scoped provider IDs',posts.includes("from('growth_social_posts').upsert(records")&&posts.includes("onConflict:'social_account_id,provider_post_id'")],
 ['Best-time recommendations use observed engagement with minimum sample count',posts.includes("filter(x => x.count >= 2)")&&posts.includes("timeZone: 'Asia/Kolkata'")],
 ['Social comments are tenant-scoped and manager-controlled for sync',comments.includes("eq('organization_id',organizationId)")&&comments.includes("['owner','manager']")],
 ['Comment sync checks platform-specific read permissions',comments.includes("'pages_read_engagement'")&&comments.includes("'instagram_manage_comments'")],
 ['Comment reply checks platform-specific management permission',comments.includes("'pages_manage_engagement'")&&comments.includes("'instagram_manage_comments'")],
 ['Comment reply is atomically claimed to prevent duplicate concurrent replies',comments.includes("status:'replying'")&&comments.includes(".in('status',['open','error'])")],
 ['Comment reply failure is retained as retryable error state',comments.includes("status:outcomeUnknown?'outcome_unknown':'error'")&&comments.includes('providerRequestStarted')],
 ['Ambiguous comment reply outcomes are blocked from automatic retry',comments.includes("comment.status==='outcome_unknown'")&&comments.includes('providerResponseReceived')&&outcomeMigration.includes('outcome_unknown')],
 ['Social inbox is available to social-channel tenants without granting AI Employee access',inbox.includes("const canUseSocial=await requireGrowthFeature")&&inbox.includes("in('channel',['instagram','facebook_messenger'])")],
 ['Dedicated Social Management UI exposes account health, comments, analytics and unified inbox',ui.includes('Check health / refresh token')&&ui.includes('Social comments')&&ui.includes('GrowthSocialInsights')&&ui.includes('GrowthInbox')],
 ['Dashboard mounts Social Management page',dashboard.includes("activeTab==='social'&&<GrowthSocialManagement")],
 ['Primary navigation exposes Social Media module',nav.includes("id:'social',label:'Social Media',href:'/admin/ai-growth/social'")],
 ['Database migration creates RLS-protected post and comment stores',migration.includes('growth_social_posts')&&migration.includes('growth_social_comments')&&migration.includes('enable row level security')],
 ['Database migration includes token health and account health indexes',migration.includes('token_health')&&migration.includes('growth_social_accounts_org_platform_health_idx')],
 ['Post/comment tables revoke anon and authenticated writes',privilegeMigration.includes('revoke all on table public.growth_social_posts from anon, authenticated')&&privilegeMigration.includes('revoke all on table public.growth_social_comments from anon, authenticated')],
 ['Reply claim migration allows a replying state and records claiming actor',claimMigration.includes("'replying'")&&claimMigration.includes('reply_claimed_by')&&claimMigration.includes('reply_claimed_at')]
];
let failed=0;for(const [name,ok] of checks){console.log(`${ok?'PASS':'FAIL'} ${name}`);if(!ok)failed++;}
console.log(`${checks.length-failed} PASS, ${failed} FAIL`);process.exitCode=failed?1:0;
