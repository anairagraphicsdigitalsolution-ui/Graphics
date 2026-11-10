import { NextRequest, NextResponse } from 'next/server';
import { growthContext, requireGrowthRole } from '@/lib/growth-server';
import { encryptSecret } from '@/lib/growth-crypto';
export const runtime='nodejs';
const json=(body:unknown,status=200)=>NextResponse.json(body,{status,headers:{'Cache-Control':'no-store'}});
const fields='id,waba_id,phone_number_id,display_phone_number,verified_name,graph_api_version,connection_status,last_verified_at,last_error,created_at,updated_at';
export async function GET(req:NextRequest){
 const c=await growthContext(req);if('response'in c)return c.response;
 const org=req.nextUrl.searchParams.get('organizationId')||'';
 if(!await requireGrowthRole(c.db,c.userId,org,['owner','manager','editor','viewer']))return json({error:'Workspace permission denied.'},403);
 const {data,error}=await c.db.from('growth_whatsapp_connections').select(fields).eq('organization_id',org).order('created_at',{ascending:true});
 if(error)return json({error:'WhatsApp connection migration may not be applied.'},500);
 return json({connections:data||[],connection:(data||[])[0]||null,legacyConfigured:process.env.WHATSAPP_ORGANIZATION_ID===org&&!!process.env.WHATSAPP_ACCESS_TOKEN});
}
export async function POST(req:NextRequest){
 const c=await growthContext(req);if('response'in c)return c.response;
 try{
  const b=await req.json(),org=String(b.organizationId||''),token=String(b.accessToken||'').trim(),phoneId=String(b.phoneNumberId||'').trim(),wabaId=String(b.wabaId||'').trim(),version=String(b.graphApiVersion||process.env.META_GRAPH_API_VERSION||'v22.0');
  if(!org||!token||!/^[0-9]{5,30}$/.test(phoneId)||!/^(v\d+\.\d+)$/.test(version))return json({error:'Organization, access token, valid phone number ID and Graph API version are required.'},400);
  if(!await requireGrowthRole(c.db,c.userId,org,['owner']))return json({error:'Only the organization owner can connect WhatsApp numbers.'},403);
  const verify=await fetch(`https://graph.facebook.com/${version}/${phoneId}?fields=id,display_phone_number,verified_name${wabaId?'&waba_id='+encodeURIComponent(wabaId):''}`,{headers:{Authorization:`Bearer ${token}`},cache:'no-store'});
  const details=await verify.json().catch(()=>({}));
  if(!verify.ok||String(details.id||'')!==phoneId)return json({error:'Meta could not verify this phone number ID and token.',details:details.error?.message||'Provider verification failed.'},422);
  const encrypted=encryptSecret({access_token:token});
  const {data,error}=await c.db.from('growth_whatsapp_connections').upsert({organization_id:org,waba_id:wabaId||null,phone_number_id:phoneId,display_phone_number:details.display_phone_number||null,verified_name:details.verified_name||null,encrypted_credentials:encrypted,graph_api_version:version,connection_status:'connected',connected_by:c.userId,last_verified_at:new Date().toISOString(),last_error:null,updated_at:new Date().toISOString()},{onConflict:'phone_number_id'}).select(fields).single();
  if(error)return json({error:error.code==='23505'?'This WhatsApp phone number is already connected to another workspace.':'Unable to save WhatsApp connection.'},409);
  await c.db.from('growth_platform_audit_events').insert({organization_id:org,actor_user_id:c.userId,event_type:'whatsapp.connection_created',metadata:{phone_number_id:phoneId,waba_id:wabaId||null}});
  return json({connection:data},201);
 }catch(e){return json({error:e instanceof Error?e.message:'Unable to connect WhatsApp.'},400);}
}
export async function DELETE(req:NextRequest){
 const c=await growthContext(req);if('response'in c)return c.response;
 try{
  const b=await req.json(),org=String(b.organizationId||''),connectionId=String(b.connectionId||'');
  if(!await requireGrowthRole(c.db,c.userId,org,['owner']))return json({error:'Only the organization owner can disconnect WhatsApp.'},403);
  if(!connectionId)return json({error:'Select a WhatsApp number to disconnect.'},400);
  const {data,error}=await c.db.from('growth_whatsapp_connections').update({connection_status:'disconnected',encrypted_credentials:'revoked',updated_at:new Date().toISOString()}).eq('organization_id',org).eq('id',connectionId).select('id,phone_number_id').maybeSingle();
  if(error)return json({error:'Unable to disconnect WhatsApp.'},500);
  if(!data)return json({error:'WhatsApp connection not found.'},404);
  await c.db.from('growth_platform_audit_events').insert({organization_id:org,actor_user_id:c.userId,event_type:'whatsapp.connection_disconnected',metadata:{phone_number_id:data.phone_number_id}});
  return json({disconnected:true,connectionId:data.id});
 }catch{return json({error:'Invalid disconnect request.'},400);}
}
