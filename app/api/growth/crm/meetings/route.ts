import { NextRequest } from 'next/server';
import { apiJson, growthContext, requireGrowthFeature, requireGrowthRole } from '@/lib/growth-server';
export const runtime = 'nodejs';
const clean = (v: unknown, max = 500) => String(v ?? '').trim().slice(0, max);
const modes = ['online', 'phone', 'in_person'];
const statuses = ['scheduled', 'completed', 'cancelled', 'no_show'];

export async function GET(req: NextRequest) {
  const ctx = await growthContext(req); if ('response' in ctx) return ctx.response;
  const org = req.nextUrl.searchParams.get('organizationId') || '';
  const leadId = req.nextUrl.searchParams.get('leadId') || '';
  if (!org || !await requireGrowthRole(ctx.db, ctx.userId, org, ['owner','manager','editor','viewer','client'])) return apiJson({ error: 'Workspace access denied.' }, 403);
  if (!await requireGrowthFeature(ctx.db, ctx.userId, org, 'crm')) return apiJson({ error: 'CRM is not included in this workspace plan.' }, 402);
  let q = ctx.db.from('growth_meetings').select('*').eq('organization_id', org).order('starts_at', { ascending: false }).limit(100);
  if (leadId) q = q.eq('lead_id', leadId);
  const { data, error } = await q;
  if (error) return apiJson({ error: 'Unable to load CRM meetings.' }, 500);
  return apiJson({ meetings: data || [] });
}

export async function POST(req: NextRequest) {
  const ctx = await growthContext(req); if ('response' in ctx) return ctx.response;
  try {
    const b = await req.json();
    const org = clean(b.organizationId, 80), leadId = clean(b.leadId, 80), title = clean(b.title, 180);
    const starts = typeof b.startsAt === 'string' ? new Date(b.startsAt) : null;
    const ends = typeof b.endsAt === 'string' && b.endsAt ? new Date(b.endsAt) : null;
    const mode = modes.includes(b.meetingMode) ? b.meetingMode : 'online';
    if (!org || !leadId || !title || !starts || Number.isNaN(starts.getTime()) || (ends && (Number.isNaN(ends.getTime()) || ends <= starts))) return apiJson({ error: 'Workspace, lead, title and a valid meeting start/end time are required.' }, 400);
    if (!await requireGrowthRole(ctx.db, ctx.userId, org, ['owner','manager','editor'])) return apiJson({ error: 'CRM editor permission required.' }, 403);
    if (!await requireGrowthFeature(ctx.db, ctx.userId, org, 'crm')) return apiJson({ error: 'CRM is not included in this workspace plan.' }, 402);
    const { data: lead } = await ctx.db.from('growth_leads').select('id,name').eq('id', leadId).eq('organization_id', org).maybeSingle();
    if (!lead) return apiJson({ error: 'Lead not found in this workspace.' }, 404);
    const assignedTo = typeof b.assignedTo === 'string' && b.assignedTo ? b.assignedTo : ctx.userId;
    const { data: member } = await ctx.db.from('growth_members').select('user_id').eq('organization_id', org).eq('user_id', assignedTo).maybeSingle();
    if (!member) return apiJson({ error: 'Meeting owner must be a member of this workspace.' }, 400);
    const meetingUrl = clean(b.meetingUrl, 1000) || null;
    if (mode === 'online' && meetingUrl && !/^https:\/\//i.test(meetingUrl)) return apiJson({ error: 'Online meeting links must use HTTPS.' }, 400);
    const row = { organization_id: org, lead_id: leadId, title, agenda: clean(b.agenda, 3000) || null, starts_at: starts.toISOString(), ends_at: ends?.toISOString() || null, timezone: clean(b.timezone, 80) || 'Asia/Kolkata', meeting_mode: mode, location: clean(b.location, 500) || null, meeting_url: meetingUrl, assigned_to: assignedTo, created_by: ctx.userId };
    const { data, error } = await ctx.db.from('growth_meetings').insert(row).select('*').single();
    if (error) return apiJson({ error: 'Meeting could not be saved.' }, 500);
    await ctx.db.from('growth_lead_activities').insert({ organization_id: org, lead_id: leadId, activity_type: 'meeting', body: `Meeting scheduled: ${title} (${starts.toISOString()}).`, created_by: ctx.userId, metadata: { meeting_id: data.id, status: 'scheduled' } });
    await ctx.db.from('growth_leads').update({ status: 'meeting_scheduled', updated_at: new Date().toISOString() }).eq('id', leadId).eq('organization_id', org);
    return apiJson({ meeting: data }, 201);
  } catch { return apiJson({ error: 'Invalid meeting details.' }, 400); }
}

export async function PATCH(req: NextRequest) {
  const ctx = await growthContext(req); if ('response' in ctx) return ctx.response;
  try {
    const b = await req.json(), org = clean(b.organizationId, 80), id = clean(b.meetingId, 80), status = clean(b.status, 30);
    if (!org || !id || !statuses.includes(status)) return apiJson({ error: 'Workspace, meeting and a valid status are required.' }, 400);
    if (!await requireGrowthRole(ctx.db, ctx.userId, org, ['owner','manager','editor'])) return apiJson({ error: 'CRM editor permission required.' }, 403);
    if (!await requireGrowthFeature(ctx.db, ctx.userId, org, 'crm')) return apiJson({ error: 'CRM is not included in this workspace plan.' }, 402);
    const { data, error } = await ctx.db.from('growth_meetings').update({ status, updated_at: new Date().toISOString() }).eq('id', id).eq('organization_id', org).select('*').maybeSingle();
    if (error || !data) return apiJson({ error: 'Meeting could not be updated.' }, 404);
    await ctx.db.from('growth_lead_activities').insert({ organization_id: org, lead_id: data.lead_id, activity_type: 'meeting', body: `Meeting ${data.title} marked ${status.replace('_',' ')}.`, created_by: ctx.userId, metadata: { meeting_id: id, status } });
    return apiJson({ meeting: data });
  } catch { return apiJson({ error: 'Invalid meeting update.' }, 400); }
}
