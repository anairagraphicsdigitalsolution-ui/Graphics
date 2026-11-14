import { NextRequest } from 'next/server';
import { createHash, randomBytes } from 'node:crypto';
import { apiJson, growthContext, requireGrowthFeature, requireGrowthRole } from '@/lib/growth-server';
export const runtime = 'nodejs';
const clean = (value: unknown, max = 500) => String(value ?? '').trim().slice(0, max);
const money = (currency: string, amount: number) => `${currency} ${Number(amount || 0).toFixed(2)}`;

/** Queue approved proposal delivery. RPC performs consent validation and an idempotent insert under a row lock. */
export async function POST(req: NextRequest) {
  const ctx = await growthContext(req);
  if ('response' in ctx) return ctx.response;
  try {
    const body = await req.json();
    const organizationId = clean(body.organizationId, 80), proposalId = clean(body.proposalId, 80);
    if (!organizationId || !proposalId) return apiJson({ error: 'Workspace and proposal are required.' }, 400);
    if (!await requireGrowthRole(ctx.db, ctx.userId, organizationId, ['owner', 'manager'])) return apiJson({ error: 'Only workspace owners or managers can send proposals.' }, 403);
    if (!await requireGrowthFeature(ctx.db, ctx.userId, organizationId, 'crm')) return apiJson({ error: 'CRM is not included in this workspace plan.' }, 402);
    const { data: proposal, error: proposalError } = await ctx.db.from('growth_proposals')
      .select('id,lead_id,reference_no,title,summary,line_items,currency,total_amount,valid_until,status')
      .eq('id', proposalId).eq('organization_id', organizationId).maybeSingle();
    if (proposalError || !proposal) return apiJson({ error: 'Proposal not found.' }, 404);
    if (proposal.status !== 'approved') return apiJson({ error: 'Only an approved proposal can be sent.' }, 409);
    const { data: lead, error: leadError } = await ctx.db.from('growth_leads')
      .select('name,email,consent_to_contact,contact_opted_out_at,email_bounced_at,email_complained_at')
      .eq('id', proposal.lead_id).eq('organization_id', organizationId).maybeSingle();
    if (leadError || !lead) return apiJson({ error: 'Proposal customer could not be loaded.' }, 404);
    if (!lead.email || !lead.consent_to_contact || lead.contact_opted_out_at || lead.email_bounced_at || lead.email_complained_at) {
      return apiJson({ error: 'A valid email address, active contact consent, and no opt-out/bounce/complaint are required.' }, 409);
    }
    const lines = Array.isArray(proposal.line_items) ? proposal.line_items : [];
    const lineText = lines.map((item: any, index: number) => {
      const description = clean(item?.description, 240) || `Item ${index + 1}`;
      const quantity = Number(item?.quantity || 0), amount = Number(item?.amount ?? quantity * Number(item?.unitPrice || 0));
      return `${index + 1}. ${description} | Qty: ${quantity} | ${money(proposal.currency, amount)} | Tax: ${money(proposal.currency, Number(item?.taxAmount || 0))}`;
    }).join('\n');
    const appBase = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL;
    if (!appBase) return apiJson({ error: 'Set NEXT_PUBLIC_APP_URL or NEXT_PUBLIC_SITE_URL before sending customer proposals.' }, 503);
    const token = randomBytes(32).toString('hex');
    const tokenHash = createHash('sha256').update(token).digest('hex');
    const responseExpiresAt = proposal.valid_until
      ? new Date(`${proposal.valid_until}T23:59:59.999Z`)
      : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    if (!Number.isFinite(responseExpiresAt.getTime()) || responseExpiresAt.getTime() <= Date.now()) return apiJson({ error: 'This proposal has expired. Extend its validity before sending.' }, 409);
    const responseUrl = new URL('/proposal-response', appBase);
    responseUrl.searchParams.set('token', token);
    const text = [
      `Hello ${clean(lead.name, 120) || 'there'},`, '', 'Please find your proposal details below.',
      `Reference: ${proposal.reference_no}`, `Title: ${proposal.title}`,
      proposal.summary ? `Scope: ${clean(proposal.summary, 2500)}` : '', '', 'Items:', lineText, '',
      `Total: ${money(proposal.currency, Number(proposal.total_amount))}`,
      proposal.valid_until ? `Valid until: ${proposal.valid_until}` : '', '',
      'Review and respond securely to this proposal:', responseUrl.toString(), '', 'Regards,', 'Your business team'
    ].filter(Boolean).join('\n').slice(0, 9000);
    const { data, error } = await ctx.db.rpc('growth_queue_proposal_email_with_response', {
      p_organization_id: organizationId, p_proposal_id: proposalId, p_actor_user_id: ctx.userId,
      p_subject: `${proposal.reference_no} | ${proposal.title}`.slice(0, 180), p_body: text,
      p_response_token_hash: tokenHash, p_response_token_expires_at: responseExpiresAt.toISOString()
    });
    if (error) {
      const message = String(error.message || 'Proposal delivery could not be queued.');
      const status = /consent|approved|owner|manager|active|already been sent/i.test(message) ? 409 : 500;
      return apiJson({ error: status === 409 ? message : 'Proposal delivery could not be queued.' }, status);
    }
    const result = Array.isArray(data) ? data[0] : data;
    if (!result?.job_id) return apiJson({ error: 'Proposal delivery queue returned no job reference.' }, 500);
    await ctx.db.from('growth_lead_activities').insert({ organization_id: organizationId, lead_id: proposal.lead_id,
      activity_type: 'email', body: `Proposal ${proposal.reference_no} queued for email delivery. It will be marked sent only after provider acceptance.`,
      created_by: ctx.userId, metadata: { proposal_id: proposalId, job_id: result.job_id, delivery_status: result.delivery_status } });
    return apiJson({ queued: true, jobId: result.job_id, deliveryStatus: result.delivery_status, message: 'Proposal is queued. Provider delivery is still pending.' }, 202);
  } catch { return apiJson({ error: 'Invalid proposal delivery request.' }, 400); }
}
