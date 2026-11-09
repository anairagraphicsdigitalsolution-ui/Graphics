import { NextRequest } from 'next/server';
import { apiJson, growthContext, requireGrowthRole } from '@/lib/growth-server';
export const runtime = 'nodejs';
export async function GET(req: NextRequest) {
  const ctx = await growthContext(req); if ('response' in ctx) return ctx.response;
  const orgId = req.nextUrl.searchParams.get('organizationId') || '';
  if (!await requireGrowthRole(ctx.db, ctx.userId, orgId, ['owner','manager','editor','viewer','client'])) return apiJson({ error: 'Workspace permission denied.' }, 403);
  const { data, error } = await ctx.db.from('growth_campaigns').select('*').eq('organization_id', orgId).order('created_at', { ascending: false }).limit(100);
  if (error) return apiJson({ error: 'Unable to load campaigns.' }, 500);
  return apiJson({ campaigns: data || [] });
}
export async function POST(req: NextRequest) {
  const ctx = await growthContext(req); if ('response' in ctx) return ctx.response;
  try {
    const b = await req.json(), orgId = String(b.organizationId || ''), name = String(b.name || '').trim().slice(0,140);
    if (!name || !await requireGrowthRole(ctx.db, ctx.userId, orgId)) return apiJson({ error: 'Campaign name and manager permission are required.' }, 403);
    const { data, error } = await ctx.db.from('growth_campaigns').insert({ organization_id: orgId, name, objective: String(b.objective || '').slice(0,1000) || null, channel: ['organic','facebook','instagram','whatsapp','email','other'].includes(b.channel) ? b.channel : 'organic', status: 'draft', configuration: { approval_required: true } }).select('*').single();
    if (error) return apiJson({ error: 'Campaign could not be created.' }, 500);
    return apiJson({ campaign: data }, 201);
  } catch { return apiJson({ error: 'Invalid campaign data.' }, 400); }
}
export async function PATCH(req: NextRequest) {
  const ctx = await growthContext(req); if ('response' in ctx) return ctx.response;
  try {
    const b = await req.json(), orgId = String(b.organizationId || ''), id = String(b.id || ''), status = String(b.status || '');
    if (!id || !['draft','pending_approval','active','paused','completed'].includes(status) || !await requireGrowthRole(ctx.db, ctx.userId, orgId)) return apiJson({ error: 'Invalid campaign action or permission denied.' }, 403);
    const { data: current } = await ctx.db.from('growth_campaigns').select('status').eq('id', id).eq('organization_id', orgId).maybeSingle();
    const valid: Record<string, string[]> = { pending_approval: ['draft'], active: ['pending_approval','paused'], paused: ['active'], completed: ['active','paused'], draft: ['pending_approval'] };
    if (!current || !valid[status]?.includes(current.status)) return apiJson({ error: `Cannot change campaign from ${current?.status || 'missing'} to ${status}.` }, 409);
    const { data, error } = await ctx.db.from('growth_campaigns').update({ status }).eq('id', id).eq('organization_id', orgId).select('*').maybeSingle();
    if (error || !data) return apiJson({ error: 'Campaign update failed.' }, 400);
    return apiJson({ campaign: data });
  } catch { return apiJson({ error: 'Invalid campaign update.' }, 400); }
}
