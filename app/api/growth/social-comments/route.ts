import { NextRequest } from 'next/server';
import { apiJson, growthContext, requireGrowthFeature, requireGrowthRole } from '@/lib/growth-server';
import { getWorkspaceAccessToken } from '@/lib/growth-integrations';
export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const ctx = await growthContext(req); if ('response' in ctx) return ctx.response;
  const organizationId = req.nextUrl.searchParams.get('organizationId') || '', status = req.nextUrl.searchParams.get('status') || 'all';
  if (!await requireGrowthRole(ctx.db,ctx.userId,organizationId,['owner','manager','editor','viewer'])) return apiJson({error:'Workspace permission denied.'},403);
  if (!await requireGrowthFeature(ctx.db,ctx.userId,organizationId,'social_channels')) return apiJson({error:'Social channels are not included in this workspace plan.'},402);
  let query = ctx.db.from('growth_social_comments').select('id,social_account_id,platform,provider_comment_id,provider_post_id,parent_comment_id,author_name,message,like_count,permalink,provider_created_at,status,reply_text,replied_at,last_error').eq('organization_id',organizationId).order('provider_created_at',{ascending:false,nullsFirst:false}).limit(200);
  if (['open','replied','error','outcome_unknown'].includes(status)) query = query.eq('status',status);
  const {data,error} = await query;
  if (error) return apiJson({error:'Social comment inbox is unavailable. Apply Module 6 migration.'},500);
  return apiJson({comments:data||[]});
}

export async function POST(req: NextRequest) {
  const ctx = await growthContext(req); if ('response' in ctx) return ctx.response;
  try {
    const body = await req.json(), organizationId = String(body.organizationId||''), action = String(body.action||'sync');
    if (!organizationId || !['sync','reply'].includes(action)) return apiJson({error:'Organization and supported comment action are required.'},400);
    if (!await requireGrowthRole(ctx.db,ctx.userId,organizationId,action==='reply'?['owner','manager','editor']:['owner','manager'])) return apiJson({error: action==='reply'?'Comment reply requires owner, manager or editor permission.':'Workspace manager permission required.'},403);
    if (!await requireGrowthFeature(ctx.db,ctx.userId,organizationId,'social_channels')) return apiJson({error:'Social channels are not included in this workspace plan.'},402);

    if (action === 'reply') {
      const commentId = String(body.commentId||''), message = String(body.message||'').trim();
      if (!commentId || message.length < 1 || message.length > 2000) return apiJson({error:'Comment and a 1–2,000 character reply are required.'},400);
      const {data:comment} = await ctx.db.from('growth_social_comments').select('id,social_account_id,platform,provider_comment_id,status,reply_claimed_at').eq('id',commentId).eq('organization_id',organizationId).maybeSingle();
      if (!comment) return apiJson({error:'Comment not found in this workspace.'},404);
      if (comment.status==='replied') return apiJson({error:'This comment already has a recorded reply.'},409);
      if (comment.status==='outcome_unknown') return apiJson({error:'The provider reply outcome is unknown. Check the original post before attempting any manual recovery; an automatic retry is blocked to avoid duplicate public replies.'},409);
      if (comment.status==='replying') { const claimedAt=comment.reply_claimed_at?Date.parse(comment.reply_claimed_at):0; if(claimedAt&&Date.now()-claimedAt>10*60*1000) await ctx.db.from('growth_social_comments').update({status:'outcome_unknown',last_error:'Reply worker stopped after claim; provider acceptance could not be confirmed. Verify the original post before retrying.',updated_at:new Date().toISOString()}).eq('id',commentId).eq('organization_id',organizationId).eq('status','replying'); return apiJson({error:'A reply is already in progress or its outcome is now marked unknown. Verify the original post before any retry.'},409); }
      const {data:account} = await ctx.db.from('growth_social_accounts').select('id,external_account_id,connection_status,scopes').eq('id',comment.social_account_id).eq('organization_id',organizationId).maybeSingle();
      if (!account || account.connection_status!=='connected' || !account.external_account_id) return apiJson({error:'The source social account is no longer connected or has no provider identity.'},409);
      const needed = comment.platform==='facebook' ? 'pages_manage_engagement' : 'instagram_manage_comments';
      if (!Array.isArray(account.scopes) || !account.scopes.includes(needed)) return apiJson({error:`This account is missing ${needed}. Reconnect Meta and grant the permission before replying.`},403);
      const claimAt = new Date().toISOString();
      const {data:claim,error:claimError} = await ctx.db.from('growth_social_comments').update({status:'replying',reply_claimed_at:claimAt,reply_claimed_by:ctx.userId,last_error:null,updated_at:claimAt}).eq('id',commentId).eq('organization_id',organizationId).in('status',['open','error']).select('id').maybeSingle();
      if (claimError) return apiJson({error:'Could not reserve this comment reply.'},500);
      if (!claim) return apiJson({error:'This comment reply was already claimed. Refresh before retrying.'},409);
      let providerResponseReceived = false, providerRequestStarted = false;
      try {
        const token = await getWorkspaceAccessToken(ctx.db,organizationId,comment.platform==='instagram'?'instagram':'meta',account.external_account_id);
        const version = process.env.META_GRAPH_API_VERSION || 'v22.0';
        const url = comment.platform==='facebook' ? `https://graph.facebook.com/${version}/${comment.provider_comment_id}/comments` : `https://graph.facebook.com/${version}/${comment.provider_comment_id}/replies`;
        providerRequestStarted = true;
        const response = await fetch(url,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({message,access_token:token}),cache:'no-store',signal:AbortSignal.timeout(15000)});
        providerResponseReceived = true;
        const result:any = await response.json().catch(()=>({}));
        if (!response.ok && response.status >= 500) { const message=String(result?.error?.message || `Meta returned HTTP ${response.status}; reply acceptance is uncertain.`).slice(0,500); await ctx.db.from('growth_social_comments').update({status:'outcome_unknown',last_error:message,updated_at:new Date().toISOString()}).eq('id',commentId).eq('organization_id',organizationId).eq('status','replying'); return apiJson({error:message,outcomeUnknown:true},502); }
        if (!response.ok) throw new Error(result?.error?.message || `Meta rejected comment reply (${response.status}).`);
        const now = new Date().toISOString();
        const {error:updateError} = await ctx.db.from('growth_social_comments').update({status:'replied',reply_text:message,provider_reply_id:String(result.id||''),replied_at:now,last_error:null,updated_at:now}).eq('id',commentId).eq('organization_id',organizationId).eq('status','replying');
        if (updateError) return apiJson({success:true,providerAccepted:true,warning:'Meta accepted the reply, but local status could not be updated. Reconcile before retrying.',providerReplyId:result.id||null},202);
        return apiJson({success:true,providerReplyId:result.id||null});
      } catch (providerError) {
        const message = providerError instanceof Error ? providerError.message.slice(0,500) : 'Meta comment reply failed.';
        const outcomeUnknown = providerRequestStarted && (!providerResponseReceived || /timeout|aborted|network|fetch failed|socket/i.test(message));
        await ctx.db.from('growth_social_comments').update({status:outcomeUnknown?'outcome_unknown':'error',last_error:message,updated_at:new Date().toISOString()}).eq('id',commentId).eq('organization_id',organizationId).eq('status','replying');
        return apiJson({error:message,outcomeUnknown},502);
      }
    }

    const accountId = String(body.accountId||'');
    if (!accountId) return apiJson({error:'Select a connected Facebook or Instagram account to sync comments.'},400);
    const {data:account} = await ctx.db.from('growth_social_accounts').select('id,platform,external_account_id,connection_status,scopes').eq('id',accountId).eq('organization_id',organizationId).maybeSingle();
    if (!account || account.connection_status!=='connected' || !account.external_account_id || !['facebook','instagram'].includes(account.platform)) return apiJson({error:'Select a connected Facebook Page or Instagram Professional account in this workspace.'},409);
    const needed = account.platform==='facebook' ? 'pages_read_engagement' : 'instagram_manage_comments';
    if (!Array.isArray(account.scopes) || !account.scopes.includes(needed)) return apiJson({error:`This account is missing ${needed}. Reconnect Meta and grant the permission before syncing comments.`},403);
    const token = await getWorkspaceAccessToken(ctx.db,organizationId,account.platform==='instagram'?'instagram':'meta',account.external_account_id);
    const version = process.env.META_GRAPH_API_VERSION || 'v22.0';
    const {data:posts,error:postsError} = await ctx.db.from('growth_social_posts').select('provider_post_id').eq('organization_id',organizationId).eq('social_account_id',account.id).order('published_at',{ascending:false,nullsFirst:false}).limit(25);
    if (postsError) throw new Error('Sync recent posts before syncing their comments.');
    if (!posts?.length) return apiJson({success:true,fetched:0,note:'No synced posts found. Sync posts first.'});
    let fetched=0,failed=0; const errors:string[]=[];
    for (const post of posts) {
      try {
        const url = new URL(`https://graph.facebook.com/${version}/${post.provider_post_id}/comments`);
        url.searchParams.set('limit','50');
        url.searchParams.set('fields',account.platform==='facebook'?'id,message,from,created_time,like_count,permalink_url':'id,text,username,timestamp,like_count');
        url.searchParams.set('access_token',token);
        const response=await fetch(url,{cache:'no-store',signal:AbortSignal.timeout(12000)}),data:any=await response.json().catch(()=>({}));
        if(!response.ok)throw new Error(data?.error?.message||`Comment fetch failed (${response.status}).`);
        const rows=(data.data||[]).map((item:any)=>({organization_id:organizationId,social_account_id:account.id,platform:account.platform,provider_comment_id:String(item.id),provider_post_id:String(post.provider_post_id),author_external_id:item.from?.id||null,author_name:String(item.from?.name||item.username||'Social user').slice(0,180),message:String(item.message||item.text||'').slice(0,5000),like_count:Math.max(0,Number(item.like_count||0)),permalink:item.permalink_url||null,provider_created_at:item.created_time||item.timestamp||null,provider_metadata:{},fetched_at:new Date().toISOString(),updated_at:new Date().toISOString()}));
        if(rows.length){const {error}=await ctx.db.from('growth_social_comments').upsert(rows,{onConflict:'social_account_id,provider_comment_id'});if(error)throw new Error('Comments fetched but database save failed.');fetched+=rows.length;}
      } catch(e){failed++;errors.push(e instanceof Error?e.message:'Comment sync failed.');}
    }
    await ctx.db.from('growth_social_accounts').update({last_synced_at:new Date().toISOString(),last_error:errors[0]||null}).eq('id',account.id).eq('organization_id',organizationId);
    return apiJson({success:fetched>0||failed===0,accountId,fetched,failed,errors:errors.slice(0,5),note:'Comment sync covers the latest 25 posts and up to 50 comments per post.'});
  } catch(error){return apiJson({error:error instanceof Error?error.message:'Social comment operation failed.'},502);}
}
