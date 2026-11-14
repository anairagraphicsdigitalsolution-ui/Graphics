import { NextRequest } from 'next/server';
import { apiJson, growthContext, requireGrowthRole, requireGrowthFeature } from '@/lib/growth-server';
export const runtime='nodejs';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const STATUSES=new Set(['new','discovered','enriched','qualified','contact_pending','contacted','interested','meeting_scheduled','proposal','negotiation','follow_up_later','won','lost']);
const TEMPERATURES=new Set(['hot','warm','cold']);
type ChangedLeadField='status'|'lead_temperature';
function fieldValue(lead:{status?:unknown;lead_temperature?:unknown}|null|undefined,key:ChangedLeadField):unknown{
 return key==='status'?lead?.status:lead?.lead_temperature;
}
export async function POST(req:NextRequest){
 const c=await growthContext(req);if('response'in c)return c.response;
 try{
  const b=await req.json(),orgId=String(b.organizationId||''),ids:string[]=Array.isArray(b.leadIds)?Array.from(new Set<string>((b.leadIds as unknown[]).map((id:unknown)=>typeof id==='string'?id.trim():''))):[];
  if(!await requireGrowthRole(c.db,c.userId,orgId,['owner','manager']))return apiJson({error:'CRM manager permission required.'},403);
  if(!await requireGrowthFeature(c.db,c.userId,orgId,'crm'))return apiJson({error:'CRM is not included in this workspace plan.'},402);
  if(ids.length<1||ids.length>100||ids.some((id:string)=>!UUID.test(id)))return apiJson({error:'Select between 1 and 100 valid leads.'},400);
  const patch:any={},changed:ChangedLeadField[]=[];
  if(b.status!==undefined){if(!STATUSES.has(String(b.status)))return apiJson({error:'Unsupported lead status.'},400);patch.status=String(b.status);changed.push('status');}
  if(b.lead_temperature!==undefined){if(!TEMPERATURES.has(String(b.lead_temperature)))return apiJson({error:'Unsupported lead temperature.'},400);patch.lead_temperature=String(b.lead_temperature);changed.push('lead_temperature');}
  if(!changed.length)return apiJson({error:'Provide status or lead_temperature to update.'},400);
  const {data:existing,error:readError}=await c.db.from('growth_leads').select('id,status,lead_temperature').eq('organization_id',orgId).in('id',ids);
  if(readError)return apiJson({error:'Unable to validate selected CRM leads.'},500);
  if((existing||[]).length!==ids.length)return apiJson({error:'One or more leads do not belong to this workspace or no longer exist.'},404);
  const now=new Date().toISOString();
  const {data:updated,error}=await c.db.from('growth_leads').update(patch).eq('organization_id',orgId).in('id',ids).select('id,status,lead_temperature');
  if(error)return apiJson({error:'Bulk lead update failed.'},500);
  const activities=(updated||[]).flatMap((lead:any)=>changed.flatMap((key:ChangedLeadField)=>{
   const previous=(existing||[]).find((x:any)=>x.id===lead.id);
   const before=fieldValue(previous,key),after=fieldValue(lead,key);
   if(String(after)===String(before))return [];
   return [{organization_id:orgId,lead_id:lead.id,activity_type:'status_change',body:`Bulk update: ${key} changed to ${String(after)}`,metadata:{field:key,value:after,bulk:true},created_by:c.userId,created_at:now}];
  }));
  if(activities.length){const {error:activityError}=await c.db.from('growth_lead_activities').insert(activities);if(activityError)return apiJson({error:'Leads were updated, but the activity timeline could not be written. Review CRM activity logs.'},500);}
  return apiJson({ok:true,updated:(updated||[]).length,changedFields:changed});
 }catch{return apiJson({error:'Invalid bulk CRM update request.'},400);}
}
