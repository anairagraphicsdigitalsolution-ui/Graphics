import { NextRequest } from 'next/server';
import { apiJson, growthContext, requireGrowthRole, requireGrowthFeature } from '@/lib/growth-server';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function access(req: NextRequest, roles = ['owner','manager','editor','viewer']) {
  const ctx = await growthContext(req); if ('response' in ctx) return { response: ctx.response } as const;
  const orgId = String(req.nextUrl.searchParams.get('organizationId') || '');
  if (!orgId || !await requireGrowthRole(ctx.db, ctx.userId, orgId, roles)) return { response: apiJson({ error: 'Workspace permission denied.' }, 403) } as const;
  if (!await requireGrowthFeature(ctx.db, ctx.userId, orgId, 'crm')) return { response: apiJson({ error: 'CRM is not included in this workspace plan.' }, 402) } as const;
  return { ctx, orgId } as const;
}

export async function GET(req: NextRequest) {
  const a = await access(req); if ('response' in a) return a.response;
  const [alerts, settings] = await Promise.all([
    a.ctx.db.from('growth_command_action_alerts').select('*').eq('organization_id',a.orgId).order('last_seen_at',{ascending:false}).limit(100),
    a.ctx.db.from('growth_command_action_alert_settings').select('approval_overdue_hours,repeated_failure_threshold,negative_feedback_threshold,escalation_after_hours').eq('organization_id',a.orgId).maybeSingle()
  ]);
  if (alerts.error) return apiJson({error:'Command alerts unavailable. Apply the Function 11 migration.'},503);
  return apiJson({alerts:alerts.data||[],settings:settings.data||{approval_overdue_hours:24,repeated_failure_threshold:3,negative_feedback_threshold:3,escalation_after_hours:24}});
}

export async function POST(req: NextRequest) {
  const a = await access(req,['owner','manager']); if ('response' in a) return a.response;
  try {
    const [settingsResult, actionsResult, feedbackResult] = await Promise.all([
      a.ctx.db.from('growth_command_action_alert_settings').select('*').eq('organization_id',a.orgId).maybeSingle(),
      a.ctx.db.from('growth_command_actions').select('id,title,status,created_at,updated_at,error_message').eq('organization_id',a.orgId).order('updated_at',{ascending:false}).limit(250),
      a.ctx.db.from('growth_command_action_feedback').select('id,feedback_type,created_at').eq('organization_id',a.orgId).eq('feedback_type','negative').gte('created_at',new Date(Date.now()-7*86400000).toISOString()).order('created_at',{ascending:false}).limit(100)
    ]);
    if (actionsResult.error || feedbackResult.error) return apiJson({error:'Alert scan could not load action outcomes. Apply Functions 6–7 migrations.'},503);
    const s = settingsResult.data || {approval_overdue_hours:24,repeated_failure_threshold:3,negative_feedback_threshold:3,escalation_after_hours:24};
    const actions = actionsResult.data || [], now = Date.now(), alerts:any[] = [];
    for (const action of actions.filter((x:any)=>x.status==='pending_approval')) {
      const ageHours=(now-new Date(action.created_at).getTime())/3600000;
      if (ageHours>=s.approval_overdue_hours) alerts.push({fingerprint:`approval_overdue:${action.id}`,category:'approval_overdue',severity:'high',title:'Approval is overdue',description:`“${action.title}” has been awaiting independent review for ${Math.floor(ageHours)} hours.`});
    }
    const failed=actions.filter((x:any)=>x.status==='failed' && now-new Date(x.updated_at||x.created_at).getTime()<=86400000);
    if (failed.length>=s.repeated_failure_threshold) alerts.push({fingerprint:'repeated_execution_failures:rolling24h',category:'repeated_execution_failures',severity:'critical',title:'Repeated action execution failures',description:`${failed.length} action execution failures were recorded in the last 24 hours. Latest: ${String(failed[0].error_message||failed[0].title||'No failure detail').slice(0,240)}.`});
    const negatives=feedbackResult.data||[];
    if (negatives.length>=s.negative_feedback_threshold) alerts.push({fingerprint:'negative_feedback:rolling7d',category:'negative_feedback',severity:'high',title:'Negative action feedback threshold reached',description:`${negatives.length} negative feedback entries were recorded in the last 7 days. Review the related actions and feedback.`});
    const synced=await a.ctx.db.rpc('sync_growth_command_action_alerts',{p_organization_id:a.orgId,p_actor_id:a.ctx.userId,p_alerts:alerts});
    if (synced.error || !synced.data?.success) return apiJson({error:synced.data?.error||'Could not persist alert scan. Apply the Function 11 migration.'},synced.data?.status||503);
    const latest=await a.ctx.db.from('growth_command_action_alerts').select('*').eq('organization_id',a.orgId).order('last_seen_at',{ascending:false}).limit(100);
    const escalationCutoff=now-s.escalation_after_hours*3600000;
    for (const alert of latest.data||[]) { if (['active','acknowledged'].includes(alert.status) && new Date(alert.first_seen_at).getTime()<=escalationCutoff) await a.ctx.db.rpc('transition_growth_command_action_alert',{p_organization_id:a.orgId,p_alert_id:alert.id,p_actor_id:a.ctx.userId,p_operation:'escalate'}); }
    const refreshed=await a.ctx.db.from('growth_command_action_alerts').select('*').eq('organization_id',a.orgId).order('last_seen_at',{ascending:false}).limit(100);
    return apiJson({success:true,signals_detected:alerts.length,alerts:refreshed.data||[],notice:'Alert scan completed. Aged unresolved alerts are escalated internally; no email or external notification was sent.'});
  } catch { return apiJson({error:'Alert scan failed.'},400); }
}

export async function PATCH(req: NextRequest) {
  const a = await access(req,['owner','manager']); if ('response' in a) return a.response;
  try {
    const body=await req.json(), operation=String(body.operation||'');
    if(operation==='update_settings') {
      const values={approval_overdue_hours:Number(body.approvalOverdueHours),repeated_failure_threshold:Number(body.repeatedFailureThreshold),negative_feedback_threshold:Number(body.negativeFeedbackThreshold),escalation_after_hours:Number(body.escalationAfterHours)};
      if(!Number.isInteger(values.approval_overdue_hours)||values.approval_overdue_hours<1||values.approval_overdue_hours>720||!Number.isInteger(values.repeated_failure_threshold)||values.repeated_failure_threshold<2||values.repeated_failure_threshold>20||!Number.isInteger(values.negative_feedback_threshold)||values.negative_feedback_threshold<2||values.negative_feedback_threshold>50||!Number.isInteger(values.escalation_after_hours)||values.escalation_after_hours<1||values.escalation_after_hours>720) return apiJson({error:'Threshold values are outside the permitted ranges.'},400);
      const {data,error}=await a.ctx.db.from('growth_command_action_alert_settings').upsert({organization_id:a.orgId,...values,updated_by:a.ctx.userId,updated_at:new Date().toISOString()},{onConflict:'organization_id'}).select('*').single();
      if(error)return apiJson({error:'Could not save alert settings. Apply the Function 11 migration.'},503);
      await a.ctx.db.from('growth_platform_audit_events').insert({organization_id:a.orgId,actor_user_id:a.ctx.userId,event_type:'growth.command_alert.settings_updated',metadata:values});
      return apiJson({success:true,settings:data,notice:'Alert thresholds updated.'});
    }
    const alertId=String(body.alertId||'');
    if(!alertId||!['acknowledge','escalate','resolve'].includes(operation))return apiJson({error:'A valid alert and operation are required.'},400);
    const {data,error}=await a.ctx.db.rpc('transition_growth_command_action_alert',{p_organization_id:a.orgId,p_alert_id:alertId,p_actor_id:a.ctx.userId,p_operation:operation});
    if(error||!data?.success)return apiJson({error:data?.error||'Alert transition failed. Apply the Function 11 migration.'},data?.status||503);
    return apiJson({success:true,transition:data,notice:operation==='escalate'?'Alert escalated to workspace management. This records an internal escalation; no external notification was sent.':operation==='acknowledge'?'Alert acknowledged.':'Alert resolved.'});
  } catch {return apiJson({error:'Invalid alert operation.'},400);}
}
