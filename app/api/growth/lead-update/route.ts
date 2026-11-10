import { NextRequest } from 'next/server';
import { apiJson, growthContext, requireGrowthRole, requireGrowthFeature } from '@/lib/growth-server';
import { runLeadUpdatedRules } from '@/lib/growth-automation';
export const runtime = 'nodejs';
const statuses = ['new','contacted','qualified','proposal','won','lost'];
const temperatures = ['hot','warm','cold'];
export async function PATCH(req: NextRequest) {
  const ctx = await growthContext(req); if ('response' in ctx) return ctx.response;
  try {
    const b = await req.json(); const orgId = String(b.organizationId || ''), leadId = String(b.leadId || '');
    if (!orgId || !leadId || !await requireGrowthRole(ctx.db, ctx.userId, orgId)) return apiJson({ error: 'Workspace permission denied.' }, 403);
    if (!await requireGrowthFeature(ctx.db, ctx.userId, orgId, 'crm')) return apiJson({ error: 'CRM is not included in this workspace plan.' }, 402);
    const { data: before, error: beforeError } = await ctx.db.from('growth_leads')
      .select('id,name,source,status,lead_temperature')
      .eq('id', leadId).eq('organization_id', orgId).maybeSingle();
    if (beforeError) return apiJson({ error: 'Lead could not be loaded before update.' }, 500);
    if (!before) return apiJson({ error: 'Lead not found.' }, 404);
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (statuses.includes(b.status)) patch.status = b.status;
    if (temperatures.includes(b.lead_temperature)) patch.lead_temperature = b.lead_temperature;
    if (Number.isInteger(b.lead_score) && b.lead_score >= 0 && b.lead_score <= 100) patch.lead_score = b.lead_score;
    if (b.assigned_to === null) patch.assigned_to = null;
    else if (typeof b.assigned_to === 'string') { const {data:member}=await ctx.db.from('growth_members').select('user_id').eq('organization_id',orgId).eq('user_id',b.assigned_to).maybeSingle(); if(!member)return apiJson({error:'Assignee must be a member of this workspace.'},400); patch.assigned_to=b.assigned_to; }
    if (b.follow_up_at === null) patch.follow_up_at = null;
    else if (typeof b.follow_up_at === 'string' && !Number.isNaN(Date.parse(b.follow_up_at))) patch.follow_up_at = new Date(b.follow_up_at).toISOString();
    if (Object.keys(patch).length === 1) return apiJson({ error: 'No valid lead changes supplied.' }, 400);
    const { data, error } = await ctx.db.from('growth_leads').update(patch).eq('id', leadId).eq('organization_id', orgId).select('id,status,lead_temperature,lead_score,follow_up_at,assigned_to,updated_at').maybeSingle();
    if (error) return apiJson({ error: 'Lead update failed.' }, 500);
    if (!data) return apiJson({ error: 'Lead not found.' }, 404);
    if(before.status!==data.status){await ctx.db.from('growth_lead_activities').insert({organization_id:orgId,lead_id:leadId,activity_type:'status_change',body:`Lead status changed from ${before.status} to ${data.status}.`,created_by:ctx.userId,metadata:{from:before.status,to:data.status}});}
    try {
      await runLeadUpdatedRules(ctx.db, orgId, { ...before, ...data }, {
        status: before.status,
        lead_temperature: before.lead_temperature
      });
    } catch (automationError) {
      // Do not fail the lead update if an optional automation enqueue is unavailable.
      console.error('Lead-change workflow enqueue failed:', automationError);
    }
    return apiJson({ lead: data });
  } catch { return apiJson({ error: 'Invalid lead update.' }, 400); }
}
