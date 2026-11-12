-- Phase 31: Prospect Intelligence, conversational voice lifecycle and campaign optimization governance.
alter table public.growth_prospects add column if not exists quality_score integer not null default 0 check (quality_score between 0 and 100);
alter table public.growth_prospects add column if not exists enrichment_status text not null default 'pending' check (enrichment_status in ('pending','enriched','partial','failed','reviewed'));
alter table public.growth_prospects add column if not exists last_enriched_at timestamptz;
alter table public.growth_prospects add column if not exists verified_website boolean not null default false;
create index if not exists growth_prospects_org_score_idx on public.growth_prospects(organization_id,quality_score desc,created_at desc);

create table if not exists public.growth_prospect_discovery_runs (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.growth_organizations(id) on delete cascade,
 created_by uuid references auth.users(id) on delete set null, industry text not null, location text not null, keywords text,
 provider text not null default 'google_custom_search', status text not null default 'queued' check(status in ('queued','running','completed','partial','failed')),
 discovered_count integer not null default 0, saved_count integer not null default 0, duplicate_count integer not null default 0, skipped_count integer not null default 0,
 error_message text, started_at timestamptz, completed_at timestamptz, created_at timestamptz not null default now()
);
create index if not exists growth_prospect_runs_org_idx on public.growth_prospect_discovery_runs(organization_id,created_at desc);
alter table public.growth_prospect_discovery_runs enable row level security;
drop policy if exists growth_prospect_runs_member_select on public.growth_prospect_discovery_runs;
create policy growth_prospect_runs_member_select on public.growth_prospect_discovery_runs for select to authenticated using (private.is_growth_member(organization_id) or public.is_anaira_admin());
grant select on public.growth_prospect_discovery_runs to authenticated;
grant all on public.growth_prospect_discovery_runs to service_role;

alter table public.growth_voice_call_attempts add column if not exists call_duration_seconds integer;
alter table public.growth_voice_call_attempts add column if not exists recording_url text;
alter table public.growth_voice_call_attempts add column if not exists recording_sid text;
alter table public.growth_voice_call_attempts add column if not exists transcript text;
alter table public.growth_voice_call_attempts add column if not exists call_summary text;
alter table public.growth_voice_call_attempts add column if not exists conversation_mode text not null default 'scripted' check(conversation_mode in ('scripted','conversation_relay'));
alter table public.growth_voice_call_attempts add column if not exists provider_payload jsonb not null default '{}'::jsonb;

create table if not exists public.growth_campaign_optimization_actions (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.growth_organizations(id) on delete cascade,
 campaign_id text not null, campaign_name text, ad_account_id text not null, social_account_id uuid,
 action_type text not null check(action_type in ('set_daily_budget','pause_campaign','resume_campaign')),
 before_value jsonb not null default '{}'::jsonb, proposed_value jsonb not null default '{}'::jsonb,
 reason text not null, status text not null default 'pending_approval' check(status in ('pending_approval','approved','applied','rejected','rolled_back','failed')),
 created_by uuid references auth.users(id) on delete set null, approved_by uuid references auth.users(id) on delete set null,
 approved_at timestamptz, applied_at timestamptz, rolled_back_at timestamptz, provider_response jsonb not null default '{}'::jsonb,
 error_message text, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index if not exists growth_campaign_opt_org_status_idx on public.growth_campaign_optimization_actions(organization_id,status,created_at desc);
alter table public.growth_campaign_optimization_actions enable row level security;
drop policy if exists growth_campaign_opt_member_select on public.growth_campaign_optimization_actions;
create policy growth_campaign_opt_member_select on public.growth_campaign_optimization_actions for select to authenticated using (private.is_growth_member(organization_id) or public.is_anaira_admin());
grant select on public.growth_campaign_optimization_actions to authenticated;
grant all on public.growth_campaign_optimization_actions to service_role;
