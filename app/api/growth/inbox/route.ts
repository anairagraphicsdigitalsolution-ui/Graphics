import { NextRequest, NextResponse } from 'next/server';
import { growthContext, requireGrowthRole } from '@/lib/growth-server';
const json=(body:unknown,status=200)=>NextResponse.json(body,{status,headers:{'Cache-Control':'no-store'}});
export async function GET(req:NextRequest){
 const ctx=await growthContext(req); if('response' in ctx)return ctx.response;
 const orgId=req.nextUrl.searchParams.get('organizationId')||'';
 if(!await requireGrowthRole(ctx.db,ctx.userId,orgId,['owner','manager','agent']))return json({error:'Forbidden.'},403);
 const {data,error}=await ctx.db.from('growth_conversations').select('id,channel,visitor_id,status,messages,assigned_to,needs_human,last_message_at,created_at,updated_at').eq('organization_id',orgId).order('last_message_at',{ascending:false,nullsFirst:false}).limit(100);
 if(error)return json({error:'Unable to load inbox.'},500);
 const ids=(data||[]).map((x:any)=>x.assigned_to).filter(Boolean);
 const {data:members}=ids.length?await ctx.db.from('growth_members').select('user_id,role').eq('organization_id',orgId).in('user_id',ids):{data:[]};
 return json({conversations:data||[],members:members||[]});
}
export async function PATCH(req:NextRequest){
 const ctx=await growthContext(req); if('response' in ctx)return ctx.response;
 let body:any;try{body=await req.json()}catch{return json({error:'Invalid JSON.'},400)}
 const orgId=String(body.organizationId||''),id=String(body.id||'');
 if(!id||!await requireGrowthRole(ctx.db,ctx.userId,orgId,['owner','manager','agent']))return json({error:'Forbidden or invalid conversation.'},403);
 const patch:any={updated_at:new Date().toISOString()};
 if(typeof body.needs_human==='boolean')patch.needs_human=body.needs_human;
 if(['open','qualified','handed_off','closed'].includes(body.status))patch.status=body.status;
 if(body.assignTo===null)patch.assigned_to=null;
 else if(typeof body.assignTo==='string'){
  const {data:member}=await ctx.db.from('growth_members').select('user_id').eq('organization_id',orgId).eq('user_id',body.assignTo).maybeSingle();
  if(!member)return json({error:'Assignee is not a member of this workspace.'},400); patch.assigned_to=body.assignTo;
 }
 const {data,error}=await ctx.db.from('growth_conversations').update(patch).eq('id',id).eq('organization_id',orgId).select('id,status,assigned_to,needs_human').maybeSingle();
 if(error||!data)return json({error:'Conversation update failed.'},500);return json({conversation:data});
}
