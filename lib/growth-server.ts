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
  const { data } = await db.from('growth_members').select('role').eq('organization_id', orgId).eq('user_id', userId).maybeSingle();
  if (roles.includes(String(data?.role || ''))) return true;
  const { data: admin } = await db.rpc('is_anaira_admin');
  return admin === true;
}
