-- Module 10: communication center dispatch identity and provider lifecycle.
create table if not exists public.growth_sms_messages (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null references public.growth_organizations(id) on delete cascade,
 lead_id uuid not null references public.growth_leads(id) on delete restrict,
 initiated_by uuid references auth.users(id) on delete set null,
 to_phone text not null,
 from_sender text not null,
 body text not null check(char_length(body) between 1 and 1600),
 status text not null default 'queued' check(status in ('dispatching','outcome_unknown','queued','accepted','sending','sent','delivered','undelivered','failed','canceled','scheduled','read')),
 provider_message_sid text unique,
 provider_status text,
 consent_verified_at timestamptz not null,
 error_code text,
 error_message text,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
alter table public.growth_sms_messages add column if not exists client_request_id text;
alter table public.growth_sms_messages add column if not exists direction text not null default 'outbound';
alter table public.growth_sms_messages add column if not exists status_updated_at timestamptz;
alter table public.growth_sms_messages add column if not exists conversation_id uuid references public.growth_conversations(id) on delete set null;
alter table public.growth_sms_messages drop constraint if exists growth_sms_messages_direction_check;
alter table public.growth_sms_messages add constraint growth_sms_messages_direction_check check (direction in ('inbound','outbound'));
create unique index if not exists growth_sms_messages_request_idempotency_idx on public.growth_sms_messages(organization_id,client_request_id) where client_request_id is not null;
create index if not exists growth_sms_messages_org_created_idx on public.growth_sms_messages(organization_id,created_at desc);
create index if not exists growth_sms_messages_org_status_idx on public.growth_sms_messages(organization_id,status,updated_at desc);

create table if not exists public.growth_sms_provider_events (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null references public.growth_organizations(id) on delete cascade,
 event_key text not null,
 provider_message_sid text not null,
 event_type text not null,
 provider_status text,
 payload jsonb not null default '{}'::jsonb check(jsonb_typeof(payload)='object'),
 received_at timestamptz not null default now(),
 processed_at timestamptz,
 unique(organization_id,event_key)
);
create index if not exists growth_sms_provider_events_org_received_idx on public.growth_sms_provider_events(organization_id,received_at desc);
alter table public.growth_sms_provider_events enable row level security;
revoke all on public.growth_sms_provider_events from public,anon,authenticated;
grant all on public.growth_sms_provider_events to service_role;

-- SMS records are private CRM communication data. API handlers use the service role
-- only after resolving the signed-in workspace membership and role.
alter table public.growth_sms_messages enable row level security;
revoke all on public.growth_sms_messages from public,anon,authenticated;
grant all on public.growth_sms_messages to service_role;

alter table public.growth_jobs drop constraint if exists growth_jobs_job_type_check;
alter table public.growth_jobs add constraint growth_jobs_job_type_check check (job_type in ('publish_content','send_whatsapp','send_email','send_whatsapp_template','send_sms','execute_rule'));
