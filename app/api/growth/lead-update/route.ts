import { NextRequest } from 'next/server';
import { apiJson, growthContext, requireGrowthRole, requireGrowthFeature } from '@/lib/growth-server';
import { runLeadUpdatedRules } from '@/lib/growth-automation';
import { googleAdsRequest, normalizeCustomerId, refreshGoogleAdsAccessToken } from '@/lib/growth-google-ads';
export const runtime = 'nodejs';
const statuses = ['new','discovered','enriched','qualified','contact_pending','contacted','interested','meeting_scheduled','proposal','negotiation','follow_up_later','won','lost'];
const temperatures = ['hot','warm','cold'];
export async function PATCH(req: NextRequest) {
  const ctx = await growthContext(req); if ('response' in ctx) return ctx.response;
  try {
    const b = await req.json(); const orgId = String(b.organizationId || ''), leadId = String(b.leadId || '');
    if (!orgId || !leadId || !await requireGrowthRole(ctx.db, ctx.userId, orgId)) return apiJson({ error: 'Workspace permission denied.' }, 403);
    if (!await requireGrowthFeature(ctx.db, ctx.userId, orgId, 'crm')) return apiJson({ error: 'CRM is not included in this workspace plan.' }, 402);
    const { data: before, error: beforeError } = await ctx.db.from('growth_leads')
      .select('id,name,source,status,lead_temperature,gclid,gbraid,wbraid,utm_source,utm_campaign,ad_user_data_consent,won_revenue,revenue_currency')
      .eq('id', leadId).eq('organization_id', orgId).maybeSingle();
    if (beforeError) return apiJson({ error: 'Lead could not be loaded before update.' }, 500);
    if (!before) return apiJson({ error: 'Lead not found.' }, 404);
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    const followUpWasProvided = Object.prototype.hasOwnProperty.call(b, 'follow_up_at');
    if (statuses.includes(b.status)) patch.status = b.status;
    if (temperatures.includes(b.lead_temperature)) patch.lead_temperature = b.lead_temperature;
    if (typeof b.won_revenue === 'number' && Number.isFinite(b.won_revenue) && b.won_revenue >= 0 && b.won_revenue <= 100000000000) patch.won_revenue = b.won_revenue;
    if (typeof b.revenue_currency === 'string' && /^[A-Z]{3}$/.test(b.revenue_currency.toUpperCase())) patch.revenue_currency = b.revenue_currency.toUpperCase();
    if (typeof b.ad_user_data_consent === 'boolean') patch.ad_user_data_consent = b.ad_user_data_consent;
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
    if (data.status === 'won' && (before.status !== 'won' || b.ad_user_data_consent === true || b.won_revenue !== undefined)) {
      const wonRevenue = Number((patch.won_revenue as number | undefined) ?? before.won_revenue ?? 0);
      const currency = String((patch.revenue_currency as string | undefined) ?? before.revenue_currency ?? 'INR').toUpperCase();
      const adConsent = typeof patch.ad_user_data_consent === 'boolean' ? patch.ad_user_data_consent : before.ad_user_data_consent === true;
      const clickId = before.gclid || before.gbraid || before.wbraid;
      const eventId = `lead-won:${leadId}`;
      const { data: integration } = await ctx.db.from('growth_integrations').select('settings').eq('organization_id', orgId).eq('provider', 'google_ads').maybeSingle();
      const conversionActionId = String(integration?.settings?.conversion_action_id || '');
      const attributionPayload = { organization_id: orgId, event_id: eventId, lead_id: leadId, conversion_action_id: conversionActionId || null, source: before.utm_source || before.source || 'crm', campaign_id: before.utm_campaign || null, gclid: before.gclid || null, gbraid: before.gbraid || null, wbraid: before.wbraid || null, event_name: 'lead_won', revenue: wonRevenue, currency, occurred_at: new Date().toISOString(), consent_status: adConsent ? 'granted' : 'unknown', metadata: { attribution: 'crm_status_transition', lead_status: 'won' } };
      const { data: insertedEvent } = await ctx.db.from('growth_attribution_events').upsert(attributionPayload, { onConflict: 'organization_id,event_id', ignoreDuplicates: true }).select('id,google_ads_upload_status').maybeSingle();
      let eventRow: { id: string; google_ads_upload_status: string | null } | null = insertedEvent;
      if (!eventRow) { const { data: existingEvent } = await ctx.db.from('growth_attribution_events').select('id,google_ads_upload_status').eq('organization_id', orgId).eq('event_id', eventId).maybeSingle(); eventRow = existingEvent as { id: string; google_ads_upload_status: string | null } | null; }
      if (eventRow && clickId && adConsent && eventRow.google_ads_upload_status !== 'uploaded') {
        try {
          const cfg = await refreshGoogleAdsAccessToken(ctx.db, orgId);
          const conversionCustomerId = normalizeCustomerId(integration?.settings?.conversion_customer_id || cfg.customerId);
          if (!conversionActionId || !/^\d+$/.test(conversionActionId) || !conversionCustomerId) throw new Error('Configure a valid Google Ads Conversion Action ID and conversion customer account in the client workspace integration.');
          const conversionDateTime = `${new Date().toISOString().slice(0,19).replace('T',' ')}+00:00`;
          const conversion: any = { conversionAction: `customers/${conversionCustomerId}/conversionActions/${conversionActionId}`, conversionDateTime, conversionValue: wonRevenue, currencyCode: currency, orderId: eventId.slice(0,64), consent: { adUserData: 'GRANTED' } };
          if (before.gclid) conversion.gclid = before.gclid; else if (before.gbraid) conversion.gbraid = before.gbraid; else conversion.wbraid = before.wbraid;
          const result = await googleAdsRequest(cfg, `customers/${conversionCustomerId}:uploadClickConversions`, { conversions: [conversion], partialFailure: true, validateOnly: false });
          if (result.partialFailureError) throw new Error(result.partialFailureError.message || 'Google Ads conversion upload failed.');
          await ctx.db.from('growth_attribution_events').update({ google_ads_upload_status: 'uploaded', google_ads_upload_response: result, google_ads_upload_error: null }).eq('id', eventRow.id);
        } catch (conversionError) {
          const message = conversionError instanceof Error ? conversionError.message : 'Google Ads conversion upload failed.';
          await ctx.db.from('growth_attribution_events').update({ google_ads_upload_status: 'failed', google_ads_upload_error: message }).eq('id', eventRow.id);
        }
      }
    }
    // Keep the CRM follow-up date and its actionable task in sync. Outreach is
    // never triggered here; this only creates an internal reminder for a user.
    if (followUpWasProvided || ['won','lost'].includes(String(data.status))) {
      const { data: existingTasks } = await ctx.db.from('growth_tasks').select('id,status').eq('organization_id',orgId).eq('lead_id',leadId).eq('task_type','follow_up').in('status',['open','in_progress']).order('created_at',{ascending:false}).limit(10);
      const tasks = existingTasks || [];
      if (['won','lost'].includes(String(data.status)) || !data.follow_up_at) {
        if (tasks.length) await ctx.db.from('growth_tasks').update({status:'cancelled',updated_at:new Date().toISOString(),completed_at:null}).eq('organization_id',orgId).in('id',tasks.map((t:any)=>t.id));
      } else {
        const taskPatch = { title:`Follow up with ${String(before.name || 'customer')}`, description:'CRM-generated reminder. Review the lead record and contact eligibility before contacting the customer.', due_at:data.follow_up_at, assigned_to:data.assigned_to || ctx.userId, status:'open', completed_at:null, updated_at:new Date().toISOString() };
        if (tasks.length) {
          await ctx.db.from('growth_tasks').update(taskPatch).eq('id',tasks[0].id).eq('organization_id',orgId);
          if (tasks.length > 1) await ctx.db.from('growth_tasks').update({status:'cancelled',updated_at:new Date().toISOString()}).eq('organization_id',orgId).in('id',tasks.slice(1).map((t:any)=>t.id));
        } else {
          await ctx.db.from('growth_tasks').insert({organization_id:orgId,lead_id:leadId,...taskPatch,task_type:'follow_up',status:'open',created_by:ctx.userId});
        }
      }
    }
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
