import {NextRequest} from 'next/server';
import {apiJson,growthContext,requireGrowthRole} from '@/lib/growth-server';
export const runtime='nodejs';
export async function PATCH(req:NextRequest){
 const ctx=await growthContext(req);if('response'in ctx)return ctx.response;
 try{
  const b=await req.json(),org=String(b.organizationId||''),leadId=String(b.leadId||'');
  if(!org||!leadId||!await requireGrowthRole(ctx.db,ctx.userId,org,['owner','manager']))return apiJson({error:'Only workspace owner or manager can change contact consent.'},403);
  const optedOut=b.optOut===true;
  const channel=String(b.channel||'').toLowerCase();
  if(channel){
   if(!['email','whatsapp','sms','voice'].includes(channel))return apiJson({error:'Choose a supported contact channel.'},400);
   const granted=b.channelConsent===true;
   if(granted&&(b.consentConfirmed!==true||typeof b.source!=='string'||!b.source.trim()))return apiJson({error:'Channel consent requires explicit confirmation and evidence describing how consent was obtained.'},400);
   const {data:consent,error:consentError}=await ctx.db.rpc('growth_set_lead_channel_consent',{
    p_organization_id:org,p_lead_id:leadId,p_actor_user_id:ctx.userId,p_channel:channel,
    p_granted:granted,p_source:String(b.source||'workspace_admin').slice(0,240),
    p_method:String(b.method||'manual_confirmation').slice(0,80)
   });
   if(consentError)return apiJson({error:'Channel consent could not be updated. Apply the channel-consent migration and verify workspace manager permissions.'},consentError.message?.includes('lead_not_found')?404:403);
   await ctx.db.from('growth_lead_activities').insert({
    organization_id:org,lead_id:leadId,activity_type:'note',
    body:`${channel} channel consent ${granted?'granted':'revoked'} by workspace manager.`,
    created_by:ctx.userId,metadata:{channel,granted,source:String(b.source||'workspace_admin').slice(0,240),method:String(b.method||'manual_confirmation').slice(0,80)}
   });
   return apiJson({success:true,channel,consent});
  }
  if(!optedOut&&(b.consentConfirmed!==true||typeof b.source!=='string'||!b.source.trim()))return apiJson({error:'Re-consent requires explicit confirmation and a source describing how consent was obtained.'},400);
  const now=new Date().toISOString();
  const patch=optedOut?{consent_to_contact:false,channel_consents:{email:{granted:false,updated_at:now,source:'global_opt_out'},whatsapp:{granted:false,updated_at:now,source:'global_opt_out'},sms:{granted:false,updated_at:now,source:'global_opt_out'},voice:{granted:false,updated_at:now,source:'global_opt_out'}},contact_opted_out_at:now,contact_opt_out_source:String(b.source||'workspace_admin').slice(0,120),updated_at:now}:{consent_to_contact:true,contact_consent_at:now,contact_consent_source:String(b.source).trim().slice(0,240),contact_consent_method:String(b.method||'manual_confirmation').slice(0,80),contact_opted_out_at:null,contact_opt_out_source:null,updated_at:now};
  const {data,error}=await ctx.db.from('growth_leads').update(patch).eq('id',leadId).eq('organization_id',org).select('id,consent_to_contact,contact_consent_at,contact_consent_source,contact_opted_out_at,contact_opt_out_source').maybeSingle();
  if(error)return apiJson({error:'Consent record update failed. Apply the v6.65 migration.'},500);
  if(!data)return apiJson({error:'Lead not found.'},404);
  return apiJson({success:true,lead:data});
 }catch{return apiJson({error:'Invalid consent update.'},400);}
}
