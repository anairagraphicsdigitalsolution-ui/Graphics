create table if not exists public.growth_public_rate_limits (
  key_hash text primary key,
  window_started_at timestamptz not null,
  hit_count integer not null default 0,
  updated_at timestamptz not null default now()
);
alter table public.growth_public_rate_limits enable row level security;
revoke all on public.growth_public_rate_limits from anon, authenticated;
grant all on public.growth_public_rate_limits to service_role;
create or replace function public.consume_growth_rate_limit(p_key text,p_limit integer,p_window_seconds integer)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare v growth_public_rate_limits%rowtype; v_now timestamptz:=clock_timestamp(); v_allowed boolean; v_retry integer;
begin
 if p_key is null or length(p_key)<>64 or p_limit<1 or p_limit>1000 or p_window_seconds<1 or p_window_seconds>86400 then raise exception 'invalid rate limit arguments'; end if;
 insert into growth_public_rate_limits(key_hash,window_started_at,hit_count,updated_at) values(p_key,v_now,1,v_now)
 on conflict(key_hash) do update set
   window_started_at=case when growth_public_rate_limits.window_started_at + make_interval(secs=>p_window_seconds)<=v_now then v_now else growth_public_rate_limits.window_started_at end,
   hit_count=case when growth_public_rate_limits.window_started_at + make_interval(secs=>p_window_seconds)<=v_now then 1 else growth_public_rate_limits.hit_count+1 end,
   updated_at=v_now returning * into v;
 v_allowed:=v.hit_count<=p_limit;
 v_retry:=greatest(1,ceil(extract(epoch from (v.window_started_at+make_interval(secs=>p_window_seconds)-v_now)))::integer);
 return jsonb_build_object('allowed',v_allowed,'remaining',greatest(0,p_limit-v.hit_count),'retry_after',v_retry);
end; $$;
revoke all on function public.consume_growth_rate_limit(text,integer,integer) from public,anon,authenticated;
grant execute on function public.consume_growth_rate_limit(text,integer,integer) to service_role;
