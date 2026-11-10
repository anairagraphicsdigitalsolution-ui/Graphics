import {SupabaseClient} from '@supabase/supabase-js';

type WorkflowStep = {type:string; delay_minutes?:number; title?:string; description?:string; message_template?:string; subject?:string; text_template?:string};
const safeSteps=(rule:any):WorkflowStep[]=>{
  const configured=Array.isArray(rule.workflow_steps)?rule.workflow_steps:[];
  if(configured.length)return configured.slice(0,12);
  const cfg=rule.configuration||{};
  if(rule.action_type==='create_follow_up')return [{type:'create_follow_up',title:cfg.title,description:cfg.description,delay_minutes:cfg.delay_minutes}];
  if(rule.action_type==='notify_admin')return [{type:'notify_admin'}];
  if(rule.action_type==='queue_whatsapp')return [{type:'queue_whatsapp',message_template:cfg.message_template}];
  return [];
};

export async function runLeadCreatedRules(db:SupabaseClient,orgId:string,lead:any){
  const {data:rules,error}=await db.from('growth_automation_rules').select('*').eq('organization_id',orgId).eq('enabled',true).eq('trigger_type','lead_created');
  if(error)throw error;
  for(const rule of rules||[]){
    const steps=safeSteps(rule);
    if(!steps.length)continue;
    await db.from('growth_workflow_runs').insert({organization_id:orgId,rule_id:rule.id,lead_id:lead.id,status:'queued',current_step:0,steps,context:{lead_name:lead.name||'',source:lead.source||'unknown'},next_run_at:new Date().toISOString()});
  }
}


/**
 * Enqueue workflows when a manager changes a lead's status or temperature.
 * Only actual transitions trigger a run; no event is generated for unchanged fields.
 */
export async function runLeadUpdatedRules(
  db: SupabaseClient,
  orgId: string,
  lead: any,
  previous: { status?: string | null; lead_temperature?: string | null }
) {
  const events: Array<{ trigger: string; changedField: string; oldValue: string; newValue: string }> = [];
  if (previous.status && lead.status && previous.status !== lead.status) {
    events.push({ trigger: 'lead_status_changed', changedField: 'status', oldValue: previous.status, newValue: lead.status });
  }
  if (previous.lead_temperature && lead.lead_temperature && previous.lead_temperature !== lead.lead_temperature) {
    events.push({ trigger: 'lead_temperature_changed', changedField: 'lead_temperature', oldValue: previous.lead_temperature, newValue: lead.lead_temperature });
  }
  for (const event of events) {
    const { data: rules, error } = await db
      .from('growth_automation_rules')
      .select('*')
      .eq('organization_id', orgId)
      .eq('enabled', true)
      .eq('trigger_type', event.trigger);
    if (error) throw error;
    for (const rule of rules || []) {
      const steps = safeSteps(rule);
      if (!steps.length) continue;
      const { error: enqueueError } = await db.from('growth_workflow_runs').insert({
        organization_id: orgId,
        rule_id: rule.id,
        lead_id: lead.id,
        status: 'queued',
        current_step: 0,
        steps,
        context: {
          lead_name: lead.name || '',
          source: lead.source || 'unknown',
          event: event.trigger,
          changed_field: event.changedField,
          previous_value: event.oldValue,
          current_value: event.newValue
        },
        next_run_at: new Date().toISOString()
      });
      if (enqueueError) throw enqueueError;
    }
  }
}
