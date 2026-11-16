import { NextRequest } from 'next/server';
import { apiJson, growthContext, requireGrowthRole, requireGrowthFeature } from '@/lib/growth-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const TYPES = ['spend', 'revenue', 'refund'] as const;
const SOURCES = ['manual', 'meta_ads', 'google_ads', 'crm', 'payment_provider', 'import'] as const;
const clean = (value: unknown, max = 160) => String(value ?? '').trim().slice(0, max);
const money = (value: unknown) => Number(Number(value || 0).toFixed(2));
const validDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(`${s}T00:00:00Z`)) && new Date(`${s}T00:00:00Z`).toISOString().slice(0, 10) === s;

export async function GET(req: NextRequest) {
  const ctx = await growthContext(req); if ('response' in ctx) return ctx.response;
  const org = clean(req.nextUrl.searchParams.get('organizationId'), 80);
  if (!org || !await requireGrowthRole(ctx.db, ctx.userId, org, ['owner','manager','editor','viewer','client'])) return apiJson({ error: 'Workspace permission denied.' }, 403);
  if (!await requireGrowthFeature(ctx.db, ctx.userId, org, 'crm')) return apiJson({ error: 'CRM is not included in this workspace plan.' }, 402);
  const from = clean(req.nextUrl.searchParams.get('from'), 10);
  const to = clean(req.nextUrl.searchParams.get('to'), 10);
  if ((from && !validDate(from)) || (to && !validDate(to)) || (from && to && from > to)) return apiJson({ error: 'Invalid reporting date range.' }, 400);
  const effectiveFrom = from || new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
  const effectiveTo = to || new Date().toISOString().slice(0, 10);
  let q = ctx.db.from('growth_marketing_financial_entries').select('id,entry_type,amount,currency,channel,campaign_id,campaign_name,lead_id,source,external_ref,entry_date,status,notes,created_at', { count: 'exact' }).eq('organization_id', org).eq('status', 'posted').order('entry_date', { ascending: false }).order('id', { ascending: true }).limit(5000);
  q = q.gte('entry_date', effectiveFrom).lte('entry_date', effectiveTo);
  const [{ data: entries, error, count }, { data: leads, error: leadError, count: leadCount }, { data: attribution, error: attributionError, count: attributionCount }] = await Promise.all([
    q,
    ctx.db.from('growth_leads').select('id,status,source,utm_source,utm_campaign,won_revenue,revenue_currency,created_at', { count: 'exact' }).eq('organization_id', org).gte('created_at', `${effectiveFrom}T00:00:00.000Z`).lte('created_at', `${effectiveTo}T23:59:59.999Z`).limit(5000),
    ctx.db.from('growth_attribution_events').select('id,event_id,source,campaign_id,event_name,revenue,currency,occurred_at', { count: 'exact' }).eq('organization_id', org).gte('occurred_at', `${effectiveFrom}T00:00:00.000Z`).lte('occurred_at', `${effectiveTo}T23:59:59.999Z`).limit(5000),
  ]);
  if (error || leadError || attributionError) return apiJson({ error: 'Financial analytics could not be loaded. Apply the Module 12 migration if the ledger is missing.' }, 500);
  const rows = entries || [], leadRows = leads || [], attributionRows = attribution || [];
  const currencies = [...new Set(rows.map((r: any) => String(r.currency || 'INR').trim().toUpperCase()))].sort();
  const byCurrency = Object.fromEntries(currencies.map(currency => {
    const group = rows.filter((r: any) => String(r.currency).trim().toUpperCase() === currency);
    const sum = (type: string) => money(group.filter((r: any) => r.entry_type === type).reduce((n: number, r: any) => n + Number(r.amount || 0), 0));
    const spend = sum('spend'), revenue = sum('revenue'), refunds = sum('refund'), netRevenue = money(revenue - refunds);
    return [currency, { spend, grossRevenue: revenue, refunds, netRevenue, roas: spend > 0 ? Number((netRevenue / spend).toFixed(3)) : null, records: group.length }];
  }));
  const campaignIds = [...new Set([...rows.map((r: any) => r.campaign_id), ...attributionRows.map((r: any) => r.campaign_id)].filter(Boolean))];
  const campaigns = campaignIds.map(campaignId => {
    const group = rows.filter((r: any) => r.campaign_id === campaignId);
    const attributed = attributionRows.filter((r: any) => String(r.campaign_id || '') === String(campaignId));
    const campaignLeads = leadRows.filter((l: any) => String(l.utm_campaign || '') === String(campaignId));
    const campaignWon = campaignLeads.filter((l: any) => l.status === 'won').length;
    const campaignCurrencies = [...new Set([...group.map((r: any) => String(r.currency).trim().toUpperCase()), ...attributed.map((r: any) => String(r.currency || 'INR').trim().toUpperCase())])];
    const perCurrency = Object.fromEntries(campaignCurrencies.map(currency => {
      const c = group.filter((r: any) => String(r.currency).trim().toUpperCase() === currency);
      const a = attributed.filter((r: any) => String(r.currency || 'INR').trim().toUpperCase() === currency);
      const spend = money(c.filter((r: any) => r.entry_type === 'spend').reduce((n: number, r: any) => n + Number(r.amount || 0), 0));
      const netRevenue = money(c.filter((r: any) => r.entry_type === 'revenue').reduce((n: number, r: any) => n + Number(r.amount || 0), 0) - c.filter((r: any) => r.entry_type === 'refund').reduce((n: number, r: any) => n + Number(r.amount || 0), 0));
      const attributedRevenue = money(a.reduce((n: number, r: any) => n + Number(r.revenue || 0), 0));
      return [currency, { spend, netRevenue, attributedRevenue, revenueVariance: money(netRevenue - attributedRevenue), roas: spend > 0 ? Number((netRevenue / spend).toFixed(3)) : null, cpl: campaignLeads.length && spend > 0 ? Number((spend / campaignLeads.length).toFixed(2)) : null, cac: campaignWon && spend > 0 ? Number((spend / campaignWon).toFixed(2)) : null }];
    }));
    return { campaignId, campaignName: group.find((r: any) => r.campaign_name)?.campaign_name || campaignId, leads: campaignLeads.length, wonLeads: campaignWon, perCurrency };
  });
  const attributedRevenueByCurrency = attributionRows.reduce((result: Record<string, number>, row: any) => { const code = String(row.currency || 'INR').trim().toUpperCase(); result[code] = money((result[code] || 0) + Number(row.revenue || 0)); return result; }, {});
  const reconciliationVarianceByCurrency = Object.fromEntries([...new Set([...Object.keys(byCurrency), ...Object.keys(attributedRevenueByCurrency)])].map(code => [code, money(Number(byCurrency[code]?.netRevenue || 0) - Number(attributedRevenueByCurrency[code] || 0))]));
  const spendRecords = rows.filter((r: any) => r.entry_type === 'spend').length;
  const revenueRecords = rows.filter((r: any) => r.entry_type === 'revenue').length;
  const refundRecords = rows.filter((r: any) => r.entry_type === 'refund').length;
  const truncatedSources = [((count ?? rows.length) > 5000 ? 'financial_ledger' : null), ((leadCount ?? leadRows.length) > 5000 ? 'leads' : null), ((attributionCount ?? attributionRows.length) > 5000 ? 'attribution_events' : null)].filter(Boolean);
  return apiJson({ period: { from: effectiveFrom, to: effectiveTo }, totalsByCurrency: byCurrency, attributedRevenueByCurrency, reconciliationVarianceByCurrency, attributionEventCount: attributionCount ?? attributionRows.length, campaigns, entries: rows.slice(0, 250), recordCount: count ?? rows.length, truncated: truncatedSources.length > 0, truncatedSources, coverage: { spendRecords, revenueRecords, refundRecords, currencies, leadRows: leadCount ?? leadRows.length, attributionRows: attributionCount ?? attributionRows.length, note: 'ROAS/CPL/CAC are reported only where actual ledger spend exists. Revenue variance compares posted ledger net revenue against attribution events; investigate differences rather than treating either side as an automatic adjustment. Currency groups are never combined. Lead counts use UTM campaign identifiers; campaign attribution requires matching campaign IDs.' } });
}

export async function POST(req: NextRequest) {
  const ctx = await growthContext(req); if ('response' in ctx) return ctx.response;
  try {
    const body = await req.json();
    const org = clean(body.organizationId, 80);
    if (!org || !await requireGrowthRole(ctx.db, ctx.userId, org, ['owner','manager'])) return apiJson({ error: 'Only workspace owners and managers can record financial entries.' }, 403);
    if (!await requireGrowthFeature(ctx.db, ctx.userId, org, 'crm')) return apiJson({ error: 'CRM is not included in this workspace plan.' }, 402);
    const entryType = clean(body.entryType, 20), source = clean(body.source || 'manual', 30), currency = clean(body.currency || 'INR', 3).toUpperCase();
    const amount = Number(body.amount), channel = clean(body.channel || 'other', 60).toLowerCase();
    const entryDate = clean(body.entryDate || new Date().toISOString().slice(0, 10), 10);
    if (!TYPES.includes(entryType as any) || !SOURCES.includes(source as any) || !/^[A-Z]{3}$/.test(currency) || !Number.isFinite(amount) || amount <= 0 || amount > 1000000000000 || !validDate(entryDate) || (entryType === 'refund' && !body.leadId && !body.externalRef && !body.campaignId)) return apiJson({ error: 'Provide a valid entry type, positive amount, ISO currency, source and date.' }, 400);
    const leadId = body.leadId ? clean(body.leadId, 64) : null;
    if (leadId) { const { data: lead } = await ctx.db.from('growth_leads').select('id').eq('id', leadId).eq('organization_id', org).maybeSingle(); if (!lead) return apiJson({ error: 'Lead does not belong to this workspace.' }, 400); }
    const payload = { organization_id: org, entry_type: entryType, amount: money(amount), currency, channel, campaign_id: clean(body.campaignId, 180) || null, campaign_name: clean(body.campaignName, 180) || null, lead_id: leadId, source, external_ref: clean(body.externalRef, 180) || null, entry_date: entryDate, notes: clean(body.notes, 1000) || null, created_by: ctx.userId, updated_at: new Date().toISOString() };
    const { data, error } = await ctx.db.from('growth_marketing_financial_entries').insert(payload).select('id,entry_type,amount,currency,channel,campaign_id,campaign_name,lead_id,source,external_ref,entry_date,status,notes,created_at').single();
    if (error?.code === '23505') return apiJson({ error: 'This source reference has already been recorded. Duplicate financial entries are blocked.' }, 409);
    if (error) return apiJson({ error: 'Financial entry could not be saved.' }, 500);
    return apiJson({ success: true, entry: data }, 201);
  } catch { return apiJson({ error: 'Invalid financial entry.' }, 400); }
}
