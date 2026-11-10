import { NextRequest } from 'next/server';
import { apiJson, growthContext, requireGrowthRole, requireGrowthFeature } from '@/lib/growth-server';
import { consumeGrowthQuota, quotaErrorMessage } from '@/lib/growth-quota';
export const runtime = 'nodejs';

function parseCsv(input: string): string[][] {
  const rows: string[][] = []; let row: string[] = [], cell = '', quoted = false;
  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    if (quoted) {
      if (ch === '"' && input[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') { row.push(cell); cell = ''; }
    else if (ch === '\n') { row.push(cell.replace(/\r$/, '')); if (row.some(v => v.trim())) rows.push(row); row = []; cell = ''; }
    else cell += ch;
  }
  if (quoted) throw new Error('CSV contains an unclosed quoted field.');
  if (cell.length || row.length) { row.push(cell.replace(/\r$/, '')); if (row.some(v => v.trim())) rows.push(row); }
  return rows;
}
const clean = (v: unknown, max: number) => String(v ?? '').trim().slice(0, max);
const validEmail = (v: string) => !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

export async function POST(req: NextRequest) {
  const ctx = await growthContext(req); if ('response' in ctx) return ctx.response;
  const orgId = String(req.headers.get('x-organization-id') || '');
  if (!orgId || !await requireGrowthRole(ctx.db, ctx.userId, orgId, ['owner', 'manager'])) return apiJson({ error: 'Workspace manager permission required.' }, 403);
  if (!await requireGrowthFeature(ctx.db, ctx.userId, orgId, 'crm')) return apiJson({ error: 'CRM is not included in this workspace plan.' }, 402);
  const contentType = req.headers.get('content-type') || '';
  if (!contentType.includes('text/csv')) return apiJson({ error: 'Upload a CSV file.' }, 415);
  const raw = await req.text();
  if (!raw.trim() || raw.length > 1024 * 1024) return apiJson({ error: 'CSV must be non-empty and no larger than 1 MB.' }, 400);
  try {
    const rows = parseCsv(raw);
    if (rows.length < 2) return apiJson({ error: 'CSV needs a header and at least one data row.' }, 400);
    if (rows.length > 501) return apiJson({ error: 'Maximum 500 lead rows per import.' }, 400);
    const headers = rows[0].map(v => v.trim().toLowerCase().replace(/[\s-]+/g, '_'));
    const index = (name: string) => headers.indexOf(name);
    if (index('name') < 0 || (index('email') < 0 && index('phone') < 0)) return apiJson({ error: 'CSV headers must include name and at least one of email or phone.' }, 400);
    const existing = await ctx.db.from('growth_leads').select('email,phone').eq('organization_id', orgId).limit(5000);
    if (existing.error) return apiJson({ error: 'Could not check existing workspace contacts.' }, 500);
    const keys = new Set<string>();
    for (const lead of existing.data || []) { if (lead.email) keys.add(`e:${String(lead.email).toLowerCase()}`); if (lead.phone) keys.add(`p:${String(lead.phone).replace(/\D/g, '')}`); }
    const inserts: any[] = []; let duplicates = 0, invalid = 0;
    for (const values of rows.slice(1)) {
      const get = (name: string) => { const i = index(name); return i < 0 ? '' : clean(values[i], name === 'requirement' ? 1500 : 500); };
      const name = get('name'), email = get('email').toLowerCase(), phone = get('phone'), requirement = get('requirement');
      if (!name || (!email && !phone) || !validEmail(email)) { invalid++; continue; }
      const emailKey = email ? `e:${email}` : '', phoneKey = phone ? `p:${phone.replace(/\D/g, '')}` : '';
      if ((emailKey && keys.has(emailKey)) || (phoneKey && keys.has(phoneKey))) { duplicates++; continue; }
      if (emailKey) keys.add(emailKey); if (phoneKey) keys.add(phoneKey);
      const status = ['new','contacted','qualified','proposal','won','lost'].includes(get('status').toLowerCase()) ? get('status').toLowerCase() : 'new';
      const temperature = ['hot','warm','cold'].includes(get('temperature').toLowerCase()) ? get('temperature').toLowerCase() : 'warm';
      const scoreRaw = Number(get('score')); const score = Number.isInteger(scoreRaw) && scoreRaw >= 0 && scoreRaw <= 100 ? scoreRaw : 50;
      inserts.push({ organization_id: orgId, name, email: email || null, phone: phone || null, requirement: requirement || null, source: get('source') || 'csv_import', status, lead_temperature: temperature, lead_score: score, consent_to_contact: false });
    }
    let imported = 0;
    if (inserts.length) {
      const quota = await consumeGrowthQuota(ctx.db, orgId, 'leads', inserts.length, undefined, { source: 'crm_csv_import' });
      if (!quota.allowed) return apiJson({ error: quotaErrorMessage(quota), quota }, quota.reason === 'quota_exceeded' ? 402 : 503);
      const { data, error } = await ctx.db.from('growth_leads').insert(inserts).select('id');
      if (error) return apiJson({ error: 'Database rejected the import. No leads were imported.', imported: 0, duplicates, invalid }, 500);
      imported = data?.length || 0;
    }
    await ctx.db.from('growth_platform_audit_events').insert({ organization_id: orgId, actor_user_id: ctx.userId, event_type: 'crm.leads_imported', metadata: { imported, duplicates, invalid } });
    return apiJson({ imported, duplicates, invalid, total_rows: rows.length - 1 });
  } catch (error) { return apiJson({ error: error instanceof Error ? error.message : 'CSV parsing failed.' }, 400); }
}
