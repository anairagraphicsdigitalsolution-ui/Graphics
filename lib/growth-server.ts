import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

export function apiJson(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
}

export async function growthContext(req: NextRequest): Promise<{ db: SupabaseClient; userId: string } | { response: NextResponse }> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !anon || !service) return { response: apiJson({ error: 'Server integrations are not configured.' }, 503) };
  const header = req.headers.get('authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token) return { response: apiJson({ error: 'Sign in required.' }, 401) };
  const auth = createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: { user }, error } = await auth.auth.getUser(token);
  if (error || !user) return { response: apiJson({ error: 'Invalid or expired session.' }, 401) };
  return { db: createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } }), userId: user.id };
}

export async function requireGrowthRole(db: SupabaseClient, userId: string, orgId: string, roles = ['owner', 'manager']) {
  if (!orgId) return false;
  const [{ data: organization }, { data: member }] = await Promise.all([
    db.from('growth_organizations').select('status').eq('id', orgId).maybeSingle(),
    db.from('growth_members').select('role').eq('organization_id', orgId).eq('user_id', userId).maybeSingle(),
  ]);
  if (!organization) return false;
  if (roles.includes(String(member?.role || '')) && organization.status === 'active') return true;
  // growthContext uses a service-role client, so auth.uid() inside an RPC is null.
  // Resolve the already-verified bearer-token user explicitly against the platform allow-list.
  const { data: admin, error } = await db.from('admin_users').select('user_id').eq('user_id', userId).maybeSingle();
  return !error && Boolean(admin?.user_id);
}


/**
 * Plan feature entitlement check. Missing keys preserve legacy plans; an
 * explicit false is a hard deny. Platform administrators bypass tenant plans.
 */
export async function requireGrowthFeature(db: SupabaseClient, userId: string, orgId: string, feature: string): Promise<boolean> {
  if (!orgId || !/^[a-z][a-z0-9_]{1,63}$/.test(feature)) return false;
  const { data: platformAdmin, error: adminError } = await db.from('admin_users').select('user_id').eq('user_id', userId).maybeSingle();
  if (!adminError && platformAdmin?.user_id) return true;
  const [{ data: organization, error: orgError }, { data: subscription, error: subError }] = await Promise.all([
    db.from('growth_organizations').select('id,plan,status').eq('id', orgId).maybeSingle(),
    db.from('growth_subscriptions').select('status,period_end,plan:growth_plans(features,is_active)').eq('organization_id', orgId).maybeSingle(),
  ]);
  if (orgError || subError || !organization || organization.status !== 'active') return false;
  let features: any = null;
  if (subscription) {
    if (!['active','trialing'].includes(String(subscription.status)) || Date.parse(String(subscription.period_end)) <= Date.now()) return false;
    const plan: any = subscription.plan;
    if (!plan?.is_active) return false;
    features = plan.features;
  } else {
    const { data: legacyPlan, error } = await db.from('growth_plans').select('features').eq('slug', organization.plan).eq('is_active', true).maybeSingle();
    if (error) return false;
    features = legacyPlan?.features;
  }
  if (!features || typeof features !== 'object' || Array.isArray(features)) return true;
  return features[feature] !== false;
}
