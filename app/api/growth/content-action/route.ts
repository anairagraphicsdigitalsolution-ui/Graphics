import { NextRequest } from 'next/server';
import { apiJson, growthContext, requireGrowthRole } from '@/lib/growth-server';
export const runtime = 'nodejs';
export async function PATCH(req: NextRequest) {
  const ctx = await growthContext(req); if ('response' in ctx) return ctx.response;
  try {
    const b = await req.json(), orgId = String(b.organizationId || ''), id = String(b.contentId || ''), action = String(b.action || '');
    if (!id || !await requireGrowthRole(ctx.db, ctx.userId, orgId)) return apiJson({ error: 'Workspace manager permission required.' }, 403);
    const { data: current, error: currentError } = await ctx.db.from('growth_content').select('id,status').eq('id', id).eq('organization_id', orgId).maybeSingle();
    if (currentError || !current) return apiJson({ error: 'Content not found.' }, 404);
    const transitions: Record<string, string> = { submit: 'draft', approve: 'pending_approval', reject: 'pending_approval', schedule: 'approved' };
    if (transitions[action] !== current.status) return apiJson({ error: `Cannot ${action} content while it is ${current.status}.` }, 409);
    const allowed: Record<string, Record<string, unknown>> = {
      submit: { status: 'pending_approval' }, approve: { status: 'approved' }, reject: { status: 'draft' },
      schedule: { status: 'scheduled', scheduled_at: typeof b.scheduled_at === 'string' && !Number.isNaN(Date.parse(b.scheduled_at)) ? new Date(b.scheduled_at).toISOString() : null },
    };
    const patch = allowed[action]; if (!patch) return apiJson({ error: 'Unsupported content action.' }, 400);
    if (action === 'schedule' && !patch.scheduled_at) return apiJson({ error: 'A valid future schedule date is required.' }, 400);
    if (action === 'schedule' && Date.parse(String(patch.scheduled_at)) <= Date.now()) return apiJson({ error: 'Schedule time must be in the future.' }, 400);
    const { data, error } = await ctx.db.from('growth_content').update(patch).eq('id', id).eq('organization_id', orgId).select('id,title,status,scheduled_at,platform').maybeSingle();
    if (error || !data) return apiJson({ error: 'Content status could not be updated.' }, 400);
    if (action === 'schedule') {
      const { error: jobError } = await ctx.db.from('growth_jobs').insert({ organization_id: orgId, job_type: 'publish_content', payload: { content_id: id }, run_at: data.scheduled_at });
      if (jobError) { await ctx.db.from('growth_content').update({ status: 'approved', scheduled_at: null }).eq('id', id).eq('organization_id', orgId); return apiJson({ error: 'Content was not queued. Retry scheduling.' }, 500); }
    }
    return apiJson({ content: data, note: action === 'schedule' ? 'Scheduled publishing job queued. A Vercel cron worker and connected platform account are required for publishing.' : 'Content status updated.' });
  } catch { return apiJson({ error: 'Invalid content action.' }, 400); }
}
