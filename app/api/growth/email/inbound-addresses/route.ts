import { NextRequest, NextResponse } from 'next/server';
import { growthContext, requireGrowthRole } from '@/lib/growth-server';
const json=(body:unknown,status=200)=>NextResponse.json(body,{status,headers:{'Cache-Control':'no-store'}});
const normalize=(v:unknown)=>String(v||'').trim().toLowerCase();
export async function GET(req:NextRequest){
 const c=await growthContext(req);if('response'in c)return c.response;
 const org=req.nextUrl.searchParams.get('organizationId')||'';
 if(!await requireGrowthRole(c.db,c.userId,org,['owner','manager']))return json({error:'Manager permission required.'},403);
 const {data,error}=await c.db.from('growth_inbound_email_addresses').select('id,email_address,is_active,created_at').eq('organization_id',org).order('created_at',{ascending:false});
 if(error)return json({error:'Unable to load inbound addresses.'},500);return json({addresses:data||[]});
}
export async function POST(req:NextRequest){
 const c=await growthContext(req);if('response'in c)return c.response;
 let b:any;try{b=await req.json()}catch{return json({error:'Invalid JSON.'},400)}
 const org=String(b.organizationId||''),address=normalize(b.emailAddress);
 if(!await requireGrowthRole(c.db,c.userId,org,['owner']))return json({error:'Workspace owner permission required.'},403);
 if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address))return json({error:'Enter a valid inbound email address.'},400);
 const {data,error}=await c.db.from('growth_inbound_email_addresses').upsert({organization_id:org,email_address:address,is_active:true,created_by:c.userId},{onConflict:'email_address'}).select('id,email_address,is_active').single();
 if(error)return json({error:error.code==='23505'?'This address is already assigned to another workspace.':'Unable to save inbound address.'},409);
 return json({address:data});
}
export async function DELETE(req:NextRequest){
 const c=await growthContext(req);if('response'in c)return c.response;
 let b:any;try{b=await req.json()}catch{return json({error:'Invalid JSON.'},400)}
 const org=String(b.organizationId||''),id=String(b.id||'');
 if(!id||!await requireGrowthRole(c.db,c.userId,org,['owner']))return json({error:'Workspace owner permission required.'},403);
 const {error}=await c.db.from('growth_inbound_email_addresses').delete().eq('id',id).eq('organization_id',org);
 if(error)return json({error:'Unable to remove inbound address.'},500);return json({removed:true});
}
