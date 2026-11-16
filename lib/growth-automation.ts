import {SupabaseClient} from '@supabase/supabase-js';

type WorkflowStep = {type:string; delay_minutes?:number; title?:string; description?:string; message_template?:string; subject?:string; text_template?:string};
/** Resolve the exact immutable version that the manager published. Never execute
 * mutable draft steps for a versioned workflow. */
async function publishedSteps(db:SupabaseClient,orgId:string,rule:any):Promise<WorkflowStep[]>{
  const publishedVersion=Number(rule.published_version||0);
  if(!Number.isInteger(publishedVersion)||publishedVersion<1) return [];
  const {data:snapshot,error}=await db.from('growth_workflow_versions')
    .select('workflow_steps,trigger_type')
    .eq('organization_id',orgId).eq('rule_id',rule.id).eq('version',publishedVersion).maybeSingle();
  if(error)throw error;
  if(!snapshot)throw new Error(`Published workflow snapshot v${publishedVersion} is missing for rule ${rule.id}.`);
  if(snapshot.trigger_type!==rule.trigger_type)throw new Error(`Published workflow trigger does not match rule ${rule.id}.`);
  const steps=Array.isArray(snapshot.workflow_steps)?snapshot.workflow_steps.slice(0,12):[];
  if(!steps.length)throw new Error(`Published workflow snapshot v${publishedVersion} has no executable steps.`);
  return steps;
};

export async function runLeadCreatedRules(db:SupabaseClient,orgId:string,lead:any){
  const {data:rules,error}=await db.from('growth_automation_rules').select('*').eq('organization_id',orgId).eq('enabled',true).not('published_version','is',null).eq('trigger_type','lead_created');
  if(error)throw error;
  for(const rule of rules||[]){
    const steps=await publishedSteps(db,orgId,rule);
    if(!steps.length)continue;
    const {error:enqueueError}=await db.from('growth_workflow_runs').insert({organization_id:orgId,rule_id:rule.id,lead_id:lead.id,status:'queued',current_step:0,steps,context:{lead_name:lead.name||'',source:lead.source||'unknown',published_version:Number(rule.published_version)},next_run_at:new Date().toISOString()});
    if(enqueueError)throw enqueueError;
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
      .not('published_version', 'is', null)
      .eq('trigger_type', event.trigger);
    if (error) throw error;
    for (const rule of rules || []) {
      const steps = await publishedSteps(db, orgId, rule);
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
          current_value: event.newValue,
          published_version: Number(rule.published_version)
        },
        next_run_at: new Date().toISOString()
      });
      if (enqueueError) throw enqueueError;
    }
  }
}
