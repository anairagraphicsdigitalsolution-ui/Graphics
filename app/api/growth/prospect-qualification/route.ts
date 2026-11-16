import { NextRequest } from 'next/server';
import { apiJson, growthContext, requireGrowthRole } from '@/lib/growth-server';
import { getWorkspaceIntegration } from '@/lib/growth-integrations';

export const runtime = 'nodejs';
export const maxDuration = 45;
const clean = (v: unknown, n = 500) => String(v ?? '').trim().slice(0, n);
const clamp = (v: unknown) => { const n = Number(v); return Number.isFinite(n) ? Math.max(0, Math.min(100, Math.round(n))) : 0; };

async function qualifyWithAI(db: any, orgId: string, prospect: any, target: string, directEnquiry: string) {
  const integration = await getWorkspaceIntegration(db, orgId, 'openai');
  const key = clean(integration.credentials.api_key || process.env.OPENAI_API_KEY, 500);
  const model = clean(integration.settings.model || process.env.OPENAI_MODEL || 'gpt-4.1-mini', 100);
  if (!key) throw new Error('OpenAI is not configured for this workspace. Connect it under Integrations.');
  const evidence = {
    company: prospect.company_name,
    website: prospect.website,
    websiteVerified: prospect.verified_website,
    email: prospect.email,
    phone: prospect.phone,
    industry: prospect.industry,
    location: prospect.location,
    publicWebsiteNotes: clean(prospect.notes, 1800),
    enrichmentStatus: prospect.enrichment_status,
    directEnquiry: directEnquiry || null,
  };
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST', cache: 'no-store',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(20000),
    body: JSON.stringify({ model, temperature: 0.1, response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: 'You are a cautious B2B prospect analyst. Use only supplied evidence. Never infer buying intent from contact details, a website alone, or industry fit. Separate ICP fit from demonstrated intent. Missing facts must be unknown. Do not invent budget, authority, need, timeline, or consent. Return JSON only.' },
        { role: 'user', content: `Evaluate this prospect against the workspace target: ${target || 'No explicit ICP target supplied; assess only evidence quality and fit.'}. Evidence: ${JSON.stringify(evidence)}. Return {fit_score:0-100,intent_score:0-100,qualification_status:"qualified"|"nurture"|"disqualified"|"needs_review",evidence:[{claim,source,confidence:"high"|"medium"|"low"}],intent_evidence:[{claim,source}],unknowns:[],reasoning,recommended_next_step}. intent_evidence may cite only directEnquiry and must use source exactly user_provided_enquiry. If directEnquiry is empty, intent_score MUST be 0 and intent_evidence MUST be empty. Never use website, contact details, industry fit or public snippets as buying-intent evidence. A high fit score is not proof of buying intent. Use needs_review when evidence is insufficient.` }
      ] })
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error?.message || 'AI qualification provider failed.');
  const raw = payload.choices?.[0]?.message?.content;
  if (!raw) throw new Error('AI returned an empty qualification result.');
  let parsed: any; try { parsed = JSON.parse(raw); } catch { throw new Error('AI returned invalid qualification JSON. Please retry.'); }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('AI returned an invalid qualification object.');
  return parsed;
}

export async function POST(req: NextRequest) {
  const c = await growthContext(req); if ('response' in c) return c.response;
  try {
    const body = await req.json();
    const orgId = clean(body.organizationId, 80), prospectId = clean(body.prospectId, 80);
    if (!orgId || !prospectId) return apiJson({ error: 'Workspace and prospect are required.' }, 400);
    if (!await requireGrowthRole(c.db, c.userId, orgId, ['owner', 'manager'])) return apiJson({ error: 'Workspace owner or manager permission required.' }, 403);
    const { data: prospect, error } = await c.db.from('growth_prospects').select('*').eq('id', prospectId).eq('organization_id', orgId).maybeSingle();
    if (error || !prospect) return apiJson({ error: 'Prospect not found in this workspace.' }, 404);
    const directEnquiry = clean(body.directEnquiry, 2000);
    const targetAudience = clean(body.targetAudience || body.idealCustomerProfile, 1200);
    const result = await qualifyWithAI(c.db, orgId, prospect, targetAudience, directEnquiry);
    const allowed = ['qualified', 'nurture', 'disqualified', 'needs_review'];
    const status = allowed.includes(result.qualification_status) ? result.qualification_status : 'needs_review';
    const evidence = {
      assessed_at: new Date().toISOString(), assessed_by: 'openai', model: clean(body.model || process.env.OPENAI_MODEL || 'workspace-default', 100),
      fit_score: clamp(result.fit_score), evidence: Array.isArray(result.evidence) ? result.evidence.slice(0, 12).map((x: any) => ({ claim: clean(x.claim, 300), source: clean(x.source, 240), confidence: ['high','medium','low'].includes(x.confidence) ? x.confidence : 'low' })) : [],
      unknowns: Array.isArray(result.unknowns) ? result.unknowns.slice(0, 12).map((x: any) => clean(x, 240)) : [],
      direct_enquiry_provided: Boolean(directEnquiry),
      intent_evidence: directEnquiry && Array.isArray(result.intent_evidence) ? result.intent_evidence.slice(0, 8).filter((x: any) => clean(x.source, 80) === 'user_provided_enquiry' && clean(x.claim, 300)).map((x: any) => ({ claim: clean(x.claim, 300), source: 'user_provided_enquiry' })) : [],
      reasoning: clean(result.reasoning, 1200), recommended_next_step: clean(result.recommended_next_step, 500), target_audience: targetAudience || null,
    };
    // Server-side gate: public web/contact data can never create buying intent.
    const hasDirectIntentEvidence = Boolean(directEnquiry) && evidence.intent_evidence.length > 0;
    const intentScore = hasDirectIntentEvidence ? clamp(result.intent_score) : 0;
    const { data: updated, error: saveError } = await c.db.from('growth_prospects').update({
      quality_score: evidence.fit_score, intent_score: intentScore, qualification_status: status,
      qualification_evidence: evidence, qualified_at: new Date().toISOString(), updated_at: new Date().toISOString()
    }).eq('id', prospectId).eq('organization_id', orgId).select('id,company_name,quality_score,intent_score,qualification_status,qualification_evidence,consent_to_contact').single();
    if (saveError) return apiJson({ error: 'Qualification was generated but could not be saved. Confirm the prospect qualification migration is applied.' }, 503);
    return apiJson({ success: true, prospect: updated, warning: 'Fit and buying intent are separate. Intent is forced to zero unless you supplied a direct enquiry and the model cited it as evidence. Qualification is not permission to contact; consent remains unchanged.' });
  } catch (e) { return apiJson({ error: e instanceof Error ? e.message : 'Prospect qualification failed.' }, 500); }
}
