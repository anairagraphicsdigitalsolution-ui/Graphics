import {createHash} from 'crypto';
import {SupabaseClient} from '@supabase/supabase-js';

/** Atomic, database-backed fixed-window limiter. Only a one-way IP digest is persisted. */
export async function enforceGrowthRateLimit(db:SupabaseClient,req:Request,scope:string,limit:number,windowSeconds:number){
  const forwarded=req.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  const ip=forwarded||req.headers.get('x-real-ip')||'unknown';
  const digest=createHash('sha256').update(`${process.env.GROWTH_RATE_LIMIT_SALT||process.env.GROWTH_TOKEN_ENCRYPTION_KEY||'anaira-growth'}:${scope}:${ip}`).digest('hex');
  const {data,error}=await db.rpc('consume_growth_rate_limit',{p_key:digest,p_limit:limit,p_window_seconds:windowSeconds});
  if(error) throw new Error('Public API rate limiter is unavailable.');
  return {allowed:data?.allowed===true,remaining:Number(data?.remaining||0),retryAfter:Number(data?.retry_after||windowSeconds)};
}
