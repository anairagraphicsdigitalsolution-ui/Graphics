import { NextRequest } from 'next/server';
import { apiJson, growthContext, requireGrowthRole } from '@/lib/growth-server';
export const runtime = 'nodejs';
const statuses = ['new','contacted','qualified','won','lost'];
const temperatures = ['hot','warm','cold'];
export async function PATCH(req: NextRequest) {
  const ctx = await growthContext(req); if ('response' in ctx) return ctx.response;
  try {
    const b = await req.json(); const orgId = String(b.organizationId || ''), leadId = String(b.leadId || '');
    if (!orgId || !leadId || !await requireGrowthRole(ctx.db, ctx.userId, orgId)) return apiJson({ error: 'Workspace permission denied.' }, 403);
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (statuses.includes(b.status)) patch.status = b.status;
    if (temperatures.includes(b.lead_temperature)) patch.lead_temperature = b.lead_temperature;
    if (Number.isInteger(b.lead_score) && b.lead_score >= 0 && b.lead_score <= 100) patch.lead_score = b.lead_score;
    if (b.follow_up_at === null) patch.follow_up_at = null;
    else if (typeof b.follow_up_at === 'string' && !Number.isNaN(Date.parse(b.follow_up_at))) patch.follow_up_at = new Date(b.follow_up_at).toISOString();
    if (Object.keys(patch).length === 1) return apiJson({ error: 'No valid lead changes supplied.' }, 400);
    const { data, error } = await ctx.db.from('growth_leads').update(patch).eq('id', leadId).eq('organization_id', orgId).select('id,status,lead_temperature,lead_score,follow_up_at,updated_at').maybeSingle();
    if (error) return apiJson({ error: 'Lead update failed.' }, 500);
    if (!data) return apiJson({ error: 'Lead not found.' }, 404);
    return apiJson({ lead: data });
  } catch { return apiJson({ error: 'Invalid lead update.' }, 400); }
}
