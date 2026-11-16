import { NextRequest } from 'next/server';
import { apiJson, growthContext, requireGrowthRole } from '@/lib/growth-server';
export const runtime = 'nodejs';
const CHANNELS = ['email', 'whatsapp', 'sms', 'voice'] as const;
const clean = (value: unknown, max = 500) => String(value ?? '').trim().slice(0, max);
export async function GET(req: NextRequest) {
  const ctx = await growthContext(req); if ('response' in ctx) return ctx.response;
  const organizationId = clean(req.nextUrl.searchParams.get('organizationId'), 80);
  const leadId = clean(req.nextUrl.searchParams.get('leadId'), 80);
  if (!organizationId || !leadId || !await requireGrowthRole(ctx.db, ctx.userId, organizationId, ['owner','manager','editor','viewer','client'])) return apiJson({ error: 'Workspace CRM access denied.' }, 403);
  const { data, error } = await ctx.db.from('growth_leads').select('id,channel_suppressions').eq('id', leadId).eq('organization_id', organizationId).maybeSingle();
  if (error) return apiJson({ error: 'Suppression data unavailable. Apply migration v6.94.1.' }, 503);
  if (!data) return apiJson({ error: 'Customer not found in this workspace.' }, 404);
  return apiJson({ suppressions: data.channel_suppressions || {} });
}
export async function PATCH(req: NextRequest) {
  const ctx = await growthContext(req); if ('response' in ctx) return ctx.response;
  try {
    const body = await req.json();
    const organizationId = clean(body.organizationId, 80), leadId = clean(body.leadId, 80), channel = clean(body.channel, 20).toLowerCase();
    const suppressed = body.suppressed === true, reason = clean(body.reason, 500);
    if (!organizationId || !leadId || !CHANNELS.includes(channel as any) || (suppressed && reason.length < 3)) return apiJson({ error: 'Workspace, customer, valid channel and a reason for suppression are required.' }, 400);
    if (!await requireGrowthRole(ctx.db, ctx.userId, organizationId, ['owner','manager'])) return apiJson({ error: 'Workspace owner or manager permission required.' }, 403);
    const { data, error } = await ctx.db.rpc('growth_set_lead_channel_suppression', {
      p_organization_id: organizationId, p_lead_id: leadId, p_actor_user_id: ctx.userId,
      p_channel: channel, p_suppressed: suppressed, p_reason: reason || null
    });
    if (error) return apiJson({ error: error.message?.includes('lead_not_found') ? 'Customer not found.' : 'Suppression update failed. Apply migration v6.94.1 and verify manager permissions.' }, error.message?.includes('lead_not_found') ? 404 : 403);
    await ctx.db.from('growth_lead_activities').insert({
      organization_id: organizationId, lead_id: leadId, activity_type: 'note',
      body: `${channel.toUpperCase()} contact ${suppressed ? 'suppressed' : 'suppression lifted'}${suppressed ? `: ${reason}` : ''}.`,
      created_by: ctx.userId, metadata: { channel, suppressed, reason: suppressed ? reason : null, policy: 'channel_suppression' }
    });
    return apiJson({ success: true, channel, suppression: data });
  } catch { return apiJson({ error: 'Invalid suppression update.' }, 400); }
}
