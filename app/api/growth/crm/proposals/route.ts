import { NextRequest } from 'next/server';
import { apiJson, growthContext, requireGrowthFeature, requireGrowthRole } from '@/lib/growth-server';
export const runtime = 'nodejs';
const clean = (v: unknown, max = 500) => String(v ?? '').trim().slice(0, max);
const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
const terminal = ['accepted','rejected','expired','cancelled'];
const transitions: Record<string, string[]> = { draft: ['pending_approval','cancelled'], pending_approval: ['draft','approved','cancelled'], approved: ['sent','cancelled'], sent: ['accepted','rejected','expired'] };

export async function GET(req: NextRequest) {
  const ctx = await growthContext(req); if ('response' in ctx) return ctx.response;
  const org = req.nextUrl.searchParams.get('organizationId') || '', leadId = req.nextUrl.searchParams.get('leadId') || '';
  if (!org || !await requireGrowthRole(ctx.db, ctx.userId, org, ['owner','manager','editor','viewer','client'])) return apiJson({ error: 'Workspace access denied.' }, 403);
  if (!await requireGrowthFeature(ctx.db, ctx.userId, org, 'crm')) return apiJson({ error: 'CRM is not included in this workspace plan.' }, 402);
  let q = ctx.db.from('growth_proposals').select('*').eq('organization_id', org).order('created_at', { ascending: false }).limit(100);
  if (leadId) q = q.eq('lead_id', leadId);
  const { data, error } = await q;
  if (error) return apiJson({ error: 'Unable to load proposals.' }, 500);
  return apiJson({ proposals: data || [] });
}

export async function POST(req: NextRequest) {
  const ctx = await growthContext(req); if ('response' in ctx) return ctx.response;
  try {
    const b = await req.json(), org = clean(b.organizationId, 80), leadId = clean(b.leadId, 80), title = clean(b.title, 180);
    if (!org || !leadId || !title) return apiJson({ error: 'Workspace, lead and proposal title are required.' }, 400);
    if (!await requireGrowthRole(ctx.db, ctx.userId, org, ['owner','manager','editor'])) return apiJson({ error: 'CRM editor permission required.' }, 403);
    if (!await requireGrowthFeature(ctx.db, ctx.userId, org, 'crm')) return apiJson({ error: 'CRM is not included in this workspace plan.' }, 402);
    const { data: lead } = await ctx.db.from('growth_leads').select('id').eq('id', leadId).eq('organization_id', org).maybeSingle();
    if (!lead) return apiJson({ error: 'Lead not found in this workspace.' }, 404);
    const rawItems = Array.isArray(b.lineItems) ? b.lineItems.slice(0, 30) : [];
    if (!rawItems.length) return apiJson({ error: 'At least one proposal line item is required.' }, 400);
    const lineItems = [] as Array<{ description: string; quantity: number; unitPrice: number; taxRate: number; amount: number; taxAmount: number }>;
    for (const item of rawItems) {
      const description = clean(item?.description, 240), quantity = Number(item?.quantity), unitPrice = Number(item?.unitPrice), taxRate = Number(item?.taxRate ?? 0);
      if (!description || !Number.isFinite(quantity) || quantity <= 0 || quantity > 100000 || !Number.isFinite(unitPrice) || unitPrice < 0 || unitPrice > 1e10 || !Number.isFinite(taxRate) || taxRate < 0 || taxRate > 100) return apiJson({ error: 'Each line item needs a description, positive quantity, non-negative price and GST/tax rate between 0 and 100.' }, 400);
      const amount = round2(quantity * unitPrice), taxAmount = round2(amount * taxRate / 100);
      lineItems.push({ description, quantity, unitPrice: round2(unitPrice), taxRate, amount, taxAmount });
    }
    const subtotal = round2(lineItems.reduce((n, item) => n + item.amount, 0));
    const taxAmount = round2(lineItems.reduce((n, item) => n + item.taxAmount, 0));
    const discountAmount = Number(b.discountAmount || 0);
    if (!Number.isFinite(discountAmount) || discountAmount < 0 || discountAmount > subtotal) return apiJson({ error: 'Discount must be between zero and the proposal subtotal.' }, 400);
    const totalAmount = round2(subtotal - discountAmount + taxAmount);
    const referenceNo = `AG-${new Date().toISOString().slice(0,10).replaceAll('-','')}-${crypto.randomUUID().slice(0,8).toUpperCase()}`;
    const currency = /^[A-Z]{3}$/.test(clean(b.currency, 3)) ? clean(b.currency, 3) : 'INR';
    const validUntil = typeof b.validUntil === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(b.validUntil) ? b.validUntil : null;
    const { data, error } = await ctx.db.from('growth_proposals').insert({ organization_id: org, lead_id: leadId, reference_no: referenceNo, title, summary: clean(b.summary, 3000) || null, line_items: lineItems, currency, subtotal, discount_amount: round2(discountAmount), tax_amount: taxAmount, total_amount: totalAmount, valid_until: validUntil, created_by: ctx.userId }).select('*').single();
    if (error) return apiJson({ error: 'Proposal draft could not be saved.' }, 500);
    await ctx.db.from('growth_lead_activities').insert({ organization_id: org, lead_id: leadId, activity_type: 'note', body: `Proposal draft ${referenceNo} created. Total ${currency} ${totalAmount.toFixed(2)}. It has not been sent to the customer.`, created_by: ctx.userId, metadata: { proposal_id: data.id, reference_no: referenceNo, total_amount: totalAmount, currency } });
    return apiJson({ proposal: data, notice: 'Draft saved. It has not been sent; use approval and a configured delivery provider before customer delivery.' }, 201);
  } catch { return apiJson({ error: 'Invalid proposal details.' }, 400); }
}

export async function PATCH(req: NextRequest) {
  const ctx = await growthContext(req); if ('response' in ctx) return ctx.response;
  try {
    const b = await req.json(), org = clean(b.organizationId, 80), id = clean(b.proposalId, 80), next = clean(b.status, 30);
    if (!org || !id || !['draft','pending_approval','approved','sent','accepted','rejected','expired','cancelled'].includes(next)) return apiJson({ error: 'Workspace, proposal and a valid status are required.' }, 400);
    if (!await requireGrowthRole(ctx.db, ctx.userId, org, ['owner','manager'])) return apiJson({ error: 'Only workspace owner or manager can approve or send proposals.' }, 403);
    if (!await requireGrowthFeature(ctx.db, ctx.userId, org, 'crm')) return apiJson({ error: 'CRM is not included in this workspace plan.' }, 402);
    const { data: current, error: loadError } = await ctx.db.from('growth_proposals').select('*').eq('id', id).eq('organization_id', org).maybeSingle();
    if (loadError || !current) return apiJson({ error: 'Proposal not found.' }, 404);
    if (!(transitions[current.status] || []).includes(next)) return apiJson({ error: `Invalid proposal transition: ${current.status} to ${next}.` }, 409);
    if (next === 'sent') return apiJson({ error: 'A proposal cannot be marked sent until an approved email or customer-delivery integration records an actual successful send.' }, 409);
    const patch: Record<string, unknown> = { status: next, updated_at: new Date().toISOString() };
    if (next === 'approved') patch.approved_by = ctx.userId;
    if (['accepted','rejected','expired'].includes(next)) patch.responded_at = new Date().toISOString();
    const { data, error } = await ctx.db.from('growth_proposals').update(patch).eq('id', id).eq('organization_id', org).select('*').maybeSingle();
    if (error || !data) return apiJson({ error: 'Proposal could not be updated.' }, 500);
    await ctx.db.from('growth_lead_activities').insert({ organization_id: org, lead_id: data.lead_id, activity_type: 'note', body: `Proposal ${data.reference_no} status changed to ${next}.`, created_by: ctx.userId, metadata: { proposal_id: id, status: next } });
    return apiJson({ proposal: data });
  } catch { return apiJson({ error: 'Invalid proposal update.' }, 400); }
}
