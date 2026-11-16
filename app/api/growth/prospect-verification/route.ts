import { NextRequest } from 'next/server';
import { apiJson, growthContext, requireGrowthRole } from '@/lib/growth-server';
import { enrichWebsite } from '@/lib/growth-prospect-enrichment';
import { getWorkspaceIntegration } from '@/lib/growth-integrations';

export const runtime = 'nodejs';
export const maxDuration = 45;
const clean = (v: unknown, n = 500) => String(v ?? '').trim().slice(0, n);

async function checkMx(email: string) {
  const domain = email.split('@')[1]?.toLowerCase() || '';
  if (!domain || !/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(domain)) return { status: 'invalid_format', domain: domain || null };
  try {
    const r = await fetch(`https://dns.google/resolve?name=${encodeURIComponent(domain)}&type=MX`, { cache: 'no-store', signal: AbortSignal.timeout(8000), headers: { accept: 'application/dns-json' } });
    const d = await r.json().catch(() => ({}));
    const records = Array.isArray(d.Answer) ? d.Answer.filter((x: any) => x.type === 15) : [];
    return { status: records.length ? 'mx_found' : 'no_mx_found', domain, records: records.slice(0, 5).map((x: any) => clean(x.data, 200)), dnsStatus: d.Status ?? null };
  } catch { return { status: 'dns_check_unavailable', domain }; }
}

async function verifyMailbox(email: string, key: string) {
  if (!key) return { status: 'provider_not_configured' };
  try {
    const u = new URL('https://api.zerobounce.net/v2/validate'); u.searchParams.set('api_key', key); u.searchParams.set('email', email);
    const r = await fetch(u, { cache: 'no-store', signal: AbortSignal.timeout(10000) });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) return { status: 'provider_error', httpStatus: r.status };
    return { status: String(d.status || 'unknown').toLowerCase(), subStatus: String(d.sub_status || '').slice(0, 80) || null, freeEmail: typeof d.free_email === 'boolean' ? d.free_email : null, account: String(d.account || '').slice(0, 120) || null, domain: String(d.domain || '').slice(0, 160) || null, provider: 'zerobounce' };
  } catch { return { status: 'provider_unavailable' }; }
}

async function verifyPhone(phone: string, sid: string, token: string) {
  if (!sid || !token) return { status: 'provider_not_configured' };
  if (!phone.startsWith('+')) return { status: 'requires_e164', reason: 'Add an explicit country calling code before carrier lookup.' };
  try {
    const u = new URL(`https://lookups.twilio.com/v2/PhoneNumbers/${encodeURIComponent(phone)}`); u.searchParams.set('Fields', 'line_type_intelligence');
    const auth = Buffer.from(`${sid}:${token}`).toString('base64');
    const r = await fetch(u, { headers: { Authorization: `Basic ${auth}` }, cache: 'no-store', signal: AbortSignal.timeout(10000) });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) return { status: 'provider_error', httpStatus: r.status };
    return { status: d.valid === true ? 'valid' : d.valid === false ? 'invalid' : 'unknown', e164: d.phone_number || null, countryCode: d.country_code || null, lineType: d.line_type_intelligence?.type || null, carrierName: d.line_type_intelligence?.carrier_name || null, provider: 'twilio_lookup' };
  } catch { return { status: 'provider_unavailable' }; }
}

export async function POST(req: NextRequest) {
  const ctx = await growthContext(req); if ('response' in ctx) return ctx.response;
  try {
    const b = await req.json(), organizationId = clean(b.organizationId, 80), prospectId = clean(b.prospectId, 80);
    if (!organizationId || !prospectId) return apiJson({ error: 'Workspace and prospect are required.' }, 400);
    if (!await requireGrowthRole(ctx.db, ctx.userId, organizationId, ['owner', 'manager'])) return apiJson({ error: 'Workspace owner or manager permission required.' }, 403);
    const { data: p, error } = await ctx.db.from('growth_prospects').select('id,website,email,phone').eq('id', prospectId).eq('organization_id', organizationId).maybeSingle();
    if (error || !p) return apiJson({ error: 'Prospect not found in this workspace.' }, 404);

    const [zeroBounce, twilioLookup] = await Promise.all([
      getWorkspaceIntegration(ctx.db, organizationId, 'zerobounce'),
      getWorkspaceIntegration(ctx.db, organizationId, 'twilio_lookup'),
    ]);
    const email = clean(p.email, 320), phone = clean(p.phone, 40), digits = phone.replace(/\D/g, '');
    const emailFormat = email ? (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? 'valid_format' : 'invalid_format') : 'not_provided';
    const phoneFormat = phone ? (digits.length >= 8 && digits.length <= 15 ? 'format_plausible' : 'invalid_length') : 'not_provided';

    // Website, email and phone checks are independent. Run them concurrently so a
    // configured provider does not make the endpoint exceed its deployment timeout.
    const [websiteResult, emailResult, phoneResult] = await Promise.all([
      p.website ? enrichWebsite(clean(p.website, 2048), 9000).then(site => ({ status: site.verified ? 'reachable' : 'unreachable_or_blocked', title: site.title, description: site.description, pagesCrawled: site.pagesCrawled })) : Promise.resolve({ status: 'not_provided' }),
      (async () => {
        if (!email || emailFormat === 'invalid_format') return { status: emailFormat, mailbox: { status: 'not_checked' } };
        const mx = await checkMx(email);
        const mailbox = await verifyMailbox(email, String(zeroBounce.credentials.api_key || process.env.ZEROBOUNCE_API_KEY || '').trim());
        return { ...mx, mailbox };
      })(),
      (async () => {
        if (!phone || phoneFormat !== 'format_plausible') return { status: phoneFormat, digitsLength: digits.length, lookup: { status: 'not_checked' } };
        const lookup = phone.startsWith('+') ? await verifyPhone(phone, String(twilioLookup.credentials.account_sid || process.env.TWILIO_ACCOUNT_SID || '').trim(), String(twilioLookup.credentials.auth_token || process.env.TWILIO_AUTH_TOKEN || '').trim()) : { status: 'requires_e164' };
        return { status: phoneFormat, digitsLength: digits.length, e164Formatted: phone.startsWith('+') ? `+${digits}` : null, lookup };
      })(),
    ]);

    const checkedAt = new Date().toISOString();
    const evidence = {
      checked_at: checkedAt, website: websiteResult, email: emailResult, phone: phoneResult,
      limitations: ['MX records only confirm domain mail routing.', 'Mailbox verification is a provider signal and does not prove mailbox ownership or permission to contact.', 'Phone lookup can validate numbering/line intelligence but does not prove the person owns the number or consents to contact.', 'A reachable website does not prove identity, buying intent or contact consent.'],
    };
    const { error: saveError } = await ctx.db.from('growth_prospects').update({ verification_checked_at: checkedAt, verification_evidence: evidence, email_domain_status: emailResult.status, phone_validation_status: phoneResult.status, updated_at: checkedAt }).eq('id', prospectId).eq('organization_id', organizationId);
    if (saveError) return apiJson({ error: 'Verification ran but could not be saved. Apply the prospect verification migration.' }, 503);
    return apiJson({ success: true, prospectId, evidence, notice: 'Technical checks only; not identity, mailbox, phone ownership, buying-intent or consent verification.' });
  } catch (e) { return apiJson({ error: e instanceof Error ? e.message : 'Prospect verification failed.' }, 500); }
}
