-- Module 13: consent-aware, human-approved customer retention email touchpoints.
create table if not exists public.growth_retention_touchpoints (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.growth_organizations(id) on delete cascade,
  lead_id uuid not null references public.growth_leads(id) on delete cascade,
  touchpoint_type text not null check (touchpoint_type in ('repeat_purchase','feedback','review','reactivation','renewal')),
  channel text not null default 'email' check (channel = 'email'),
  subject text not null check (char_length(trim(subject)) between 1 and 180),
  message_body text not null check (char_length(trim(message_body)) between 1 and 10000),
  status text not null default 'draft' check (status in ('draft','queued','sent','failed','cancelled')),
  scheduled_at timestamptz not null default now(),
  approved_by uuid references auth.users(id) on delete set null,
  approved_at timestamptz,
  job_id uuid references public.growth_jobs(id) on delete set null,
  provider_message_id text,
  sent_at timestamptz,
  failure_reason text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists growth_retention_touchpoints_org_status_schedule_idx
  on public.growth_retention_touchpoints(organization_id,status,scheduled_at asc);
create index if not exists growth_retention_touchpoints_org_lead_created_idx
  on public.growth_retention_touchpoints(organization_id,lead_id,created_at desc);
create unique index if not exists growth_retention_touchpoints_job_uidx
  on public.growth_retention_touchpoints(job_id) where job_id is not null;
alter table public.growth_retention_touchpoints enable row level security;
revoke all on public.growth_retention_touchpoints from public,anon,authenticated;
grant all on public.growth_retention_touchpoints to service_role;
comment on table public.growth_retention_touchpoints is
  'Customer retention outreach drafts and approval lifecycle. Email dispatch is queued only after a human approval; the worker rechecks consent, suppression, deliverability and workspace send policy at execution.';

-- Review requests may only dispatch through the consent-checking worker.
alter table public.growth_review_requests add column if not exists lead_id uuid references public.growth_leads(id) on delete set null;
alter table public.growth_review_requests add column if not exists job_id uuid references public.growth_jobs(id) on delete set null;
alter table public.growth_review_requests drop constraint if exists growth_review_requests_status_check;
alter table public.growth_review_requests add constraint growth_review_requests_status_check check (status in ('draft','queued','sent','failed','cancelled'));
create index if not exists growth_review_requests_org_status_idx on public.growth_review_requests(organization_id,status,created_at desc);
