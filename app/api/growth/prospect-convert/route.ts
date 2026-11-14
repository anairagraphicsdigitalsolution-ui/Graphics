import { NextRequest } from 'next/server';
import { apiJson, growthContext, requireGrowthRole, requireGrowthFeature } from '@/lib/growth-server';
import { consumeGrowthQuota, quotaErrorMessage } from '@/lib/growth-quota';
export const runtime = 'nodejs';
const clean = (value: unknown, max = 500) => String(value ?? '').trim().slice(0, max);

/** Converts a reviewed prospect into a CRM lead. Conversion never grants contact consent. */
export async function POST(req: NextRequest) {
  const ctx = await growthContext(req);
  if ('response' in ctx) return ctx.response;
  try {
    const body = await req.json();
    const organizationId = clean(body.organizationId, 80), prospectId = clean(body.prospectId, 80);
    if (!organizationId || !prospectId) return apiJson({ error: 'Workspace and prospect are required.' }, 400);
    if (!await requireGrowthRole(ctx.db, ctx.userId, organizationId, ['owner', 'manager'])) return apiJson({ error: 'Workspace owner or manager permission required.' }, 403);
    if (!await requireGrowthFeature(ctx.db, ctx.userId, organizationId, 'crm')) return apiJson({ error: 'CRM is not included in this workspace plan.' }, 402);
    const { data: prospect, error } = await ctx.db.from('growth_prospects').select('*').eq('id', prospectId).eq('organization_id', organizationId).maybeSingle();
    if (error) return apiJson({ error: 'Unable to load prospect.' }, 500);
    if (!prospect) return apiJson({ error: 'Prospect not found in this workspace.' }, 404);
    const { data: existing, error: existingError } = await ctx.db.from('growth_leads').select('id,name,status,source_prospect_id,consent_to_contact').eq('organization_id', organizationId).eq('source_prospect_id', prospectId).maybeSingle();
    if (existingError) return apiJson({ error: 'Unable to check previous conversion.' }, 500);
    if (existing) return apiJson({ success: true, duplicate: true, lead: existing, notice: 'This prospect has already been converted.' });
    const quota = await consumeGrowthQuota(ctx.db, organizationId, 'leads', 1, `prospect-convert:${prospectId}`, { source: 'prospect_conversion' });
    if (!quota.allowed) return apiJson({ error: quotaErrorMessage(quota), quota }, quota.reason === 'quota_exceeded' ? 402 : 503);
    const requirement = ['Converted from AI Growth prospect register.', prospect.qualification_status ? `AI qualification: ${prospect.qualification_status}.` : 'AI qualification: not assessed.', prospect.qualification_evidence?.reasoning ? `Assessment: ${clean(prospect.qualification_evidence.reasoning, 900)}` : '', prospect.website ? `Website: ${clean(prospect.website, 240)}` : '', prospect.industry ? `Industry: ${clean(prospect.industry, 120)}` : '', prospect.location ? `Location: ${clean(prospect.location, 160)}` : ''].filter(Boolean).join('\n');
    const intent = Math.max(0, Math.min(100, Number(prospect.intent_score || 0)));
    const { data: lead, error: insertError } = await ctx.db.from('growth_leads').insert({ organization_id: organizationId, source_prospect_id: prospectId, name: clean(prospect.contact_name || prospect.company_name, 120) || 'Unnamed prospect', email: clean(prospect.email, 160) || null, phone: clean(prospect.phone, 40) || null, source: 'ai_growth_prospect', requirement, lead_temperature: intent >= 70 ? 'hot' : intent >= 30 ? 'warm' : 'cold', lead_score: intent, consent_to_contact: false, status: 'new' }).select('id,name,email,phone,source,status,lead_temperature,lead_score,consent_to_contact,source_prospect_id').single();
    if (insertError) {
      if (insertError.code === '23505') {
        const { data: raced } = await ctx.db.from('growth_leads').select('id,name,status,source_prospect_id,consent_to_contact').eq('organization_id', organizationId).eq('source_prospect_id', prospectId).maybeSingle();
        if (raced) return apiJson({ success: true, duplicate: true, lead: raced, notice: 'This prospect was converted by another request.' });
      }
      return apiJson({ error: 'Prospect could not be converted into a CRM lead.' }, 500);
    }
    await ctx.db.from('growth_prospects').update({ status: 'converted', updated_at: new Date().toISOString() }).eq('id', prospectId).eq('organization_id', organizationId);
    await ctx.db.from('growth_lead_activities').insert({ organization_id: organizationId, lead_id: lead.id, activity_type: 'system', body: 'Lead created from AI Growth prospect register. Contact consent was not transferred; obtain and record explicit permission before outreach.', created_by: ctx.userId, metadata: { source_prospect_id: prospectId, prospect_consent_recorded: prospect.consent_to_contact === true } });
    return apiJson({ success: true, duplicate: false, lead, notice: 'Prospect converted to CRM. Contact consent remains disabled and must be verified separately.' }, 201);
  } catch (error) { return apiJson({ error: error instanceof Error ? error.message : 'Prospect conversion failed.' }, 500); }
}
