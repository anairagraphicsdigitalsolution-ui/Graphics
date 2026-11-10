import {NextRequest} from 'next/server';
import {apiJson,growthContext,requireGrowthRole} from '@/lib/growth-server';
export const runtime='nodejs';
export async function POST(req:NextRequest){
 const c=await growthContext(req);if('response'in c)return c.response;
 try{
  const b=await req.json(),org=String(b.organizationId||''),leadId=String(b.leadId||''),templateId=String(b.templateId||''),values=Array.isArray(b.values)?b.values:[];
  if(!await requireGrowthRole(c.db,c.userId,org,['owner','manager']))return apiJson({error:'Only owner or manager can queue approved WhatsApp templates.'},403);
  const [{data:lead},{data:template}]=await Promise.all([
   c.db.from('growth_leads').select('id,phone,consent_to_contact,contact_opted_out_at').eq('id',leadId).eq('organization_id',org).maybeSingle(),
   c.db.from('growth_whatsapp_templates').select('id,template_name,language,category,variables,approval_status').eq('id',templateId).eq('organization_id',org).maybeSingle()
  ]);
  if(!lead?.phone||!lead.consent_to_contact||lead.contact_opted_out_at)return apiJson({error:'Lead must have a phone number, active contact consent and no opt-out.'},400);
  if(!template||template.approval_status!=='approved')return apiJson({error:'Only templates confirmed as approved in WhatsApp Manager can be sent.'},400);
  if(values.length!==(template.variables||[]).length||values.some((v:any)=>typeof v!=='string'||v.length>1024))return apiJson({error:'Supply one text value for each approved template variable.'},400);
  const {data:job,error}=await c.db.from('growth_jobs').insert({organization_id:org,job_type:'send_whatsapp_template',payload:{lead_id:leadId,template_id:templateId,values},run_at:new Date().toISOString()}).select('id').single();
  if(error)return apiJson({error:'Unable to queue WhatsApp template.'},500);
  return apiJson({queued:true,jobId:job.id},202);
 }catch{return apiJson({error:'Invalid template send request.'},400);}
}
