-- v6.92.0: technical prospect verification evidence for scheduled AI qualification.
alter table public.growth_prospects add column if not exists verification_checked_at timestamptz;
alter table public.growth_prospects add column if not exists verification_evidence jsonb not null default '{}'::jsonb;
alter table public.growth_prospects add column if not exists email_domain_status text;
alter table public.growth_prospects add column if not exists phone_validation_status text;
create index if not exists growth_prospects_org_verification_idx on public.growth_prospects(organization_id, verification_checked_at desc);
