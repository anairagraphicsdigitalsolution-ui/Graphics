import {NextRequest} from 'next/server';
import {apiJson,growthContext,requireGrowthRole,requireGrowthFeature} from '@/lib/growth-server';
export const runtime='nodejs';
const triggers=['lead_created','lead_status_changed','lead_temperature_changed'];
const allowed=new Set(['create_follow_up','notify_admin','queue_whatsapp','queue_whatsapp_template','send_email','wait','condition']);
function validateSteps(input:any){
 if(!Array.isArray(input)||input.length<1||input.length>12)return null;
 const out:any[]=[];
 for(const raw of input){
  if(!raw||typeof raw!=='object'||!allowed.has(String(raw.type)))return null;
  const s:any={type:String(raw.type)};
  if(s.type==='wait'){const n=Number(raw.delay_minutes);if(!Number.isFinite(n)||n<1||n>10080)return null;s.delay_minutes=Math.floor(n);}
  if(s.type==='condition'){
   const allowedFields=['lead_temperature','status','source'];
   const allowedOperators=['equals','not_equals','contains'];
   const validateExpression=(node:any,depth=0):any=>{
    if(!node||typeof node!=='object'||depth>3)return null;
    if(Array.isArray(node.conditions)){
     const combinator=String(node.combinator||'all');
     if(!['all','any'].includes(combinator)||node.conditions.length<1||node.conditions.length>8)return null;
     const children=node.conditions.map((child:any)=>validateExpression(child,depth+1));
     if(children.some((child:any)=>!child))return null;
     return {combinator,conditions:children};
    }
    const field=String(node.field||''),operator=String(node.operator||'equals'),value=String(node.value??'').trim().slice(0,160);
    if(!allowedFields.includes(field)||!allowedOperators.includes(operator)||!value)return null;
    return {field,operator,value};
   };
   const skip=Number(raw.skip_steps);
   if(!Number.isInteger(skip)||skip<1||skip>11)return null;
   if(raw.expression!==undefined){const expression=validateExpression(raw.expression);if(!expression)return null;s.expression=expression;}
   else {const expression=validateExpression(raw);if(!expression)return null;s.field=expression.field;s.operator=expression.operator;s.value=expression.value;}
   s.skip_steps=skip;
  }
  if(s.type==='create_follow_up'){s.title=String(raw.title||'Follow up with new lead').slice(0,160);s.description=String(raw.description||'Workflow follow-up').slice(0,1000);}
  if(s.type==='queue_whatsapp'){const m=String(raw.message_template||'').trim();if(!m||m.length>3500)return null;s.message_template=m;}
  if(s.type==='queue_whatsapp_template'){const id=String(raw.template_id||'');if(!/^[0-9a-f-]{36}$/i.test(id))return null;s.template_id=id;}
  if(s.type==='send_email'){const subject=String(raw.subject||'Follow-up from Anaira').trim(),text=String(raw.text_template||'').trim();if(!subject||!text||subject.length>180||text.length>9000)return null;s.subject=subject;s.text_template=text;}
  out.push(s);
 }
 return out;
}
const event=async(db:any,orgId:string,runId:string,ruleId:string,type:string,details:any={})=>db.from('growth_workflow_run_events').insert({organization_id:orgId,run_id:runId,rule_id:ruleId,event_type:type,details});
function legacyWorkflowSteps(rule:any){const existing=validateSteps(rule.workflow_steps);if(existing?.length)return existing;const cfg=rule.configuration||{};if(rule.action_type==='create_follow_up')return [{type:'create_follow_up',title:String(cfg.title||'Follow up with new lead'),description:String(cfg.description||'Workflow follow-up')}];if(rule.action_type==='notify_admin')return [{type:'notify_admin'}];if(rule.action_type==='queue_whatsapp'&&cfg.message_template)return [{type:'queue_whatsapp',message_template:String(cfg.message_template)}];return [];}
export async function GET(req:NextRequest){
 const c=await growthContext(req);if('response'in c)return c.response;const orgId=req.nextUrl.searchParams.get('organizationId')||'';
 if(!await requireGrowthRole(c.db,c.userId,orgId,['owner','manager','editor','viewer','client']))return apiJson({error:'Workspace permission denied.'},403);
 if(!await requireGrowthFeature(c.db,c.userId,orgId,'automation'))return apiJson({error:'Workflow Automation is not included in this workspace plan.'},402);
 const [{data:rules,error},{data:runs},{data:versions},{data:events}]=await Promise.all([
  c.db.from('growth_automation_rules').select('*').eq('organization_id',orgId).order('created_at',{ascending:false}),
  c.db.from('growth_workflow_runs').select('id,rule_id,lead_id,status,current_step,next_run_at,last_error,created_at,completed_at,attempts').eq('organization_id',orgId).order('created_at',{ascending:false}).limit(30),
  c.db.from('growth_workflow_versions').select('id,rule_id,version,name,trigger_type,created_by,created_at').eq('organization_id',orgId).order('version',{ascending:false}).limit(100),
  c.db.from('growth_workflow_run_events').select('id,run_id,rule_id,step_index,event_type,details,created_at').eq('organization_id',orgId).order('created_at',{ascending:false}).limit(100)
 ]);
 if(error)return apiJson({error:'Unable to load workflows.'},500);
 return apiJson({rules:rules||[],runs:runs||[],versions:versions||[],events:events||[]});
}
export async function POST(req:NextRequest){
 const c=await growthContext(req);if('response'in c)return c.response;
 try{
  const b=await req.json(),orgId=String(b.organizationId||''),action=String(b.action||'create'),name=String(b.name||'').trim().slice(0,120),trigger=String(b.trigger_type||''),steps=validateSteps(b.workflow_steps);
  if(!await requireGrowthRole(c.db,c.userId,orgId,['owner','manager']))return apiJson({error:'Manager permission required.'},403);
  if(!await requireGrowthFeature(c.db,c.userId,orgId,'automation'))return apiJson({error:'Workflow Automation is not included in this workspace plan.'},402);
  if(action==='simulate'){
   if(!steps||!triggers.includes(trigger))return apiJson({error:'A valid trigger and workflow with 1–12 steps are required.'},400);
   let lead=b.sample_lead&&typeof b.sample_lead==='object'?b.sample_lead:null;
   if(b.lead_id){const {data}=await c.db.from('growth_leads').select('id,name,email,phone,status,lead_temperature,source,consent_to_contact,contact_opted_out_at').eq('id',String(b.lead_id)).eq('organization_id',orgId).maybeSingle();if(!data)return apiJson({error:'Sample lead not found in this workspace.'},404);lead=data;}
   const plan:any[]=[];for(let i=0;i<steps.length;i++){const s=steps[i];if(s.type==='condition'){if(!lead)return apiJson({error:'Condition simulation requires a workspace lead or sample lead fields.'},400);const actual=String(lead[s.field]??'').toLowerCase(),expected=String(s.value).toLowerCase(),matched=s.operator==='equals'?actual===expected:s.operator==='not_equals'?actual!==expected:actual.includes(expected);plan.push({step:i+1,type:s.type,result:matched?'matched':'not_matched',field:s.field,actual,expected});if(!matched)i+=Number(s.skip_steps||1);}else plan.push({step:i+1,type:s.type,result:'would_execute',external_effect:false});}
   return apiJson({simulation:{safe:true,executed:false,trigger,steps:plan,consentRequired:steps.some((s:any)=>['queue_whatsapp','queue_whatsapp_template','send_email'].includes(s.type)),note:'Simulation does not enqueue messages, create tasks, or call external providers.'}});
  }
  if(action!=='create'||!name||!triggers.includes(trigger)||!steps)return apiJson({error:'A valid workflow name, trigger and 1–12 supported steps are required.'},400);
  const {data:rule,error}=await c.db.from('growth_automation_rules').insert({organization_id:orgId,name,trigger_type:trigger,action_type:steps[0].type,workflow_steps:steps,version:1,enabled:false,requires_approval:true,configuration:{builder_version:3}}).select('*').single();
  if(error||!rule)return apiJson({error:'Unable to create workflow. Apply the workflow version migration first.'},500);
  const {error:versionError}=await c.db.from('growth_workflow_versions').insert({organization_id:orgId,rule_id:rule.id,version:1,name,trigger_type:trigger,workflow_steps:steps,created_by:c.userId});
  if(versionError){await c.db.from('growth_automation_rules').delete().eq('id',rule.id).eq('organization_id',orgId);return apiJson({error:'Workflow version snapshot could not be saved; workflow creation was rolled back.'},500);}
  return apiJson({rule},201);
 }catch{return apiJson({error:'Invalid workflow request.'},400);}
}
export async function PATCH(req:NextRequest){
 const c=await growthContext(req);if('response'in c)return c.response;
 try{
  const b=await req.json(),orgId=String(b.organizationId||''),id=String(b.id||''),action=String(b.action||'toggle');
  if(!id||!await requireGrowthRole(c.db,c.userId,orgId,['owner','manager']))return apiJson({error:'Manager permission required.'},403);
  const {data:rule}=await c.db.from('growth_automation_rules').select('*').eq('id',id).eq('organization_id',orgId).maybeSingle();
  if(!rule)return apiJson({error:'Workflow not found.'},404);
  if(action==='toggle'){
   if(typeof b.enabled!=='boolean')return apiJson({error:'enabled must be boolean.'},400);
   const {data,error}=await c.db.from('growth_automation_rules').update({enabled:b.enabled,published_version:b.enabled?Number(rule.version||1):null,updated_at:new Date().toISOString()}).eq('id',id).eq('organization_id',orgId).select('*').single();
   if(error)return apiJson({error:'Unable to update workflow state.'},500);return apiJson({rule:data});
  }
  if(action==='update_steps'||action==='restore_version'){
   let nextSteps=validateSteps(b.workflow_steps),nextName=String(b.name||rule.name).trim().slice(0,120),nextTrigger=String(b.trigger_type||rule.trigger_type);
   if(action==='restore_version'){
    const {data:snapshot}=await c.db.from('growth_workflow_versions').select('*').eq('id',String(b.version_id||'')).eq('rule_id',id).eq('organization_id',orgId).maybeSingle();
    if(!snapshot)return apiJson({error:'Version snapshot not found.'},404);nextSteps=validateSteps(snapshot.workflow_steps);nextName=snapshot.name;nextTrigger=snapshot.trigger_type;
   }
   if(!nextSteps||!triggers.includes(nextTrigger)||!nextName)return apiJson({error:'Workflow name, trigger or steps are invalid.'},400);
   const currentVersion=Number(rule.version||1);
   const {data:currentSnapshot}=await c.db.from('growth_workflow_versions').select('id').eq('organization_id',orgId).eq('rule_id',id).eq('version',currentVersion).maybeSingle();
   if(!currentSnapshot){const {error:baselineError}=await c.db.from('growth_workflow_versions').insert({organization_id:orgId,rule_id:id,version:currentVersion,name:rule.name,trigger_type:rule.trigger_type,workflow_steps:legacyWorkflowSteps(rule),created_by:c.userId});if(baselineError)return apiJson({error:'Unable to preserve the current workflow as a baseline version.'},500);}
   const version=currentVersion+1;
   const {data:savedVersion,error:versionError}=await c.db.from('growth_workflow_versions').insert({organization_id:orgId,rule_id:id,version,name:nextName,trigger_type:nextTrigger,workflow_steps:nextSteps,created_by:c.userId}).select('id').single();
   if(versionError||!savedVersion)return apiJson({error:'Unable to create immutable workflow version.'},500);
   const {data,error}=await c.db.from('growth_automation_rules').update({name:nextName,trigger_type:nextTrigger,action_type:nextSteps[0].type,workflow_steps:nextSteps,version,published_version:null,enabled:false,updated_at:new Date().toISOString()}).eq('id',id).eq('organization_id',orgId).eq('version',Number(rule.version||1)).select('*').maybeSingle();
   if(error||!data){await c.db.from('growth_workflow_versions').delete().eq('id',savedVersion.id).eq('organization_id',orgId);return apiJson({error:'Workflow changed concurrently or could not be updated. No orphan version was retained; reload and retry.'},409);}
   return apiJson({rule:data,versionCreated:version,requiresRepublish:true});
  }
  if(action==='retry_run'||action==='cancel_run'){
   const runId=String(b.run_id||'');const {data:run}=await c.db.from('growth_workflow_runs').select('*').eq('id',runId).eq('rule_id',id).eq('organization_id',orgId).maybeSingle();if(!run)return apiJson({error:'Workflow run not found.'},404);
   if(action==='retry_run'){
    if(run.status!=='failed')return apiJson({error:'Only failed runs can be retried.'},409);
    const {error}=await c.db.from('growth_workflow_runs').update({status:'queued',attempts:0,locked_at:null,next_run_at:new Date().toISOString(),last_error:null,completed_at:null,updated_at:new Date().toISOString()}).eq('id',runId).eq('organization_id',orgId);if(error)return apiJson({error:'Unable to queue retry.'},500);await event(c.db,orgId,runId,id,'run_retried',{from_status:run.status});return apiJson({ok:true,status:'queued'});
   }
   if(!['queued','failed'].includes(run.status))return apiJson({error:'Only queued or failed runs can be cancelled safely.'},409);
   const {error}=await c.db.from('growth_workflow_runs').update({status:'cancelled',locked_at:null,completed_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq('id',runId).eq('organization_id',orgId);if(error)return apiJson({error:'Unable to cancel run.'},500);await event(c.db,orgId,runId,id,'run_cancelled',{});return apiJson({ok:true,status:'cancelled'});
  }
  return apiJson({error:'Unsupported workflow action.'},400);
 }catch{return apiJson({error:'Invalid workflow update.'},400);}
}
