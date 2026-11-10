import {NextRequest} from 'next/server';
import {apiJson,growthContext,requireGrowthRole, requireGrowthFeature} from '@/lib/growth-server';
import {decryptSecret,encryptSecret} from '@/lib/growth-crypto';
export const runtime='nodejs';
async function youtubeToken(db:any,account:any,credentials:any){
 if(credentials?.expires_at&&Date.parse(credentials.expires_at)>Date.now()+60000)return credentials.access_token;
 if(!credentials?.refresh_token)throw new Error('YouTube refresh token missing. Reconnect the channel with offline access.');
 const response=await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id:process.env.GOOGLE_CLIENT_ID||'',client_secret:process.env.GOOGLE_CLIENT_SECRET||'',refresh_token:credentials.refresh_token,grant_type:'refresh_token'})});
 const token=await response.json().catch(()=>({}));
 if(!response.ok||!token.access_token)throw new Error(token.error_description||'YouTube token refresh failed.');
 const updated={...credentials,access_token:token.access_token,expires_at:new Date(Date.now()+Number(token.expires_in||3600)*1000).toISOString()};
 const {error}=await db.from('growth_social_accounts').update({encrypted_credentials:encryptSecret(updated),token_expires_at:updated.expires_at}).eq('id',account.id);
 if(error)throw new Error('Token refreshed but account credential update failed.');
 return updated.access_token;
}
export async function GET(req:NextRequest){
 const ctx=await growthContext(req);if('response'in ctx)return ctx.response;
 const organizationId=req.nextUrl.searchParams.get('organizationId')||'';
 const accountId=req.nextUrl.searchParams.get('socialAccountId')||'';
 const videoId=(req.nextUrl.searchParams.get('videoId')||'').trim();
 if(!organizationId||!accountId||!/^[-\w]{6,20}$/.test(videoId))return apiJson({error:'Organization, connected YouTube account and valid video ID are required.'},400);
 if(!await requireGrowthRole(ctx.db,ctx.userId,organizationId,['owner','manager','editor','viewer']))return apiJson({error:'Workspace permission denied.'},403);
 if(!await requireGrowthFeature(ctx.db,ctx.userId,organizationId,'social_channels'))return apiJson({error:'This module is not included in your workspace plan.'},402);
 const {data:account,error}=await ctx.db.from('growth_social_accounts').select('id,platform,connection_status,encrypted_credentials,account_name').eq('id',accountId).eq('organization_id',organizationId).maybeSingle();
 if(error||!account||account.platform!=='youtube'||account.connection_status!=='connected')return apiJson({error:'Choose a connected YouTube channel from this workspace.'},409);
 try{
  const credentials=decryptSecret(account.encrypted_credentials);const token=await youtubeToken(ctx.db,account,credentials);
  const url=new URL('https://www.googleapis.com/youtube/v3/videos');url.searchParams.set('part','snippet,status,processingDetails,statistics');url.searchParams.set('id',videoId);
  const response=await fetch(url,{headers:{Authorization:`Bearer ${token}`},cache:'no-store'});const body=await response.json().catch(()=>({}));
  if(!response.ok)return apiJson({error:body.error?.message||`YouTube status request failed (${response.status}).`},502);
  const video=body.items?.[0];if(!video)return apiJson({error:'Video not found or not accessible by this connected YouTube channel.'},404);
  return apiJson({video:{id:video.id,title:video.snippet?.title,channelTitle:video.snippet?.channelTitle,publishedAt:video.snippet?.publishedAt,privacyStatus:video.status?.privacyStatus,uploadStatus:video.status?.uploadStatus,license:video.status?.license,embeddable:video.status?.embeddable,publicStatsViewable:video.status?.publicStatsViewable,processingStatus:video.processingDetails?.processingStatus,processingProgress:video.processingDetails?.processingProgress,failureReason:video.processingDetails?.failureReason,rejectionReason:video.status?.rejectionReason,statistics:video.statistics},checkedAt:new Date().toISOString()});
 }catch(error){return apiJson({error:error instanceof Error?error.message:'YouTube video status check failed.'},502);}
}
