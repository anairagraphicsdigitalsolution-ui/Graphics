import {NextRequest} from 'next/server';
import {apiJson,growthContext,requireGrowthRole} from '@/lib/growth-server';
export const runtime='nodejs';
export async function PATCH(req:NextRequest){
 const ctx=await growthContext(req);if('response'in ctx)return ctx.response;
 try{
  const b=await req.json(),org=String(b.organizationId||''),leadId=String(b.leadId||'');
  if(!org||!leadId||!await requireGrowthRole(ctx.db,ctx.userId,org,['owner','manager']))return apiJson({error:'Only workspace owner or manager can change contact consent.'},403);
  const optedOut=b.optOut===true;
  if(!optedOut&&(b.consentConfirmed!==true||typeof b.source!=='string'||!b.source.trim()))return apiJson({error:'Re-consent requires explicit confirmation and a source describing how consent was obtained.'},400);
  const now=new Date().toISOString();
  const patch=optedOut?{consent_to_contact:false,contact_opted_out_at:now,contact_opt_out_source:String(b.source||'workspace_admin').slice(0,120),updated_at:now}:{consent_to_contact:true,contact_consent_at:now,contact_consent_source:String(b.source).trim().slice(0,240),contact_consent_method:String(b.method||'manual_confirmation').slice(0,80),contact_opted_out_at:null,contact_opt_out_source:null,updated_at:now};
  const {data,error}=await ctx.db.from('growth_leads').update(patch).eq('id',leadId).eq('organization_id',org).select('id,consent_to_contact,contact_consent_at,contact_consent_source,contact_opted_out_at,contact_opt_out_source').maybeSingle();
  if(error)return apiJson({error:'Consent record update failed. Apply the v6.65 migration.'},500);
  if(!data)return apiJson({error:'Lead not found.'},404);
  return apiJson({success:true,lead:data});
 }catch{return apiJson({error:'Invalid consent update.'},400);}
}
