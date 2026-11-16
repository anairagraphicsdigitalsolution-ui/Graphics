-- Workspace send-time policy and per-channel contact suppression.
alter table public.growth_organizations
  add column if not exists communication_policy jsonb not null default '{"quiet_hours":{"enabled":false,"start":"21:00","end":"08:00","timezone":"Asia/Kolkata","days":[0,1,2,3,4,5,6]},"channel_enabled":{"email":true,"whatsapp":true,"sms":true,"voice":true}}'::jsonb;
alter table public.growth_organizations
  drop constraint if exists growth_organizations_communication_policy_object;
alter table public.growth_organizations
  add constraint growth_organizations_communication_policy_object
  check (jsonb_typeof(communication_policy)='object');
alter table public.growth_leads
  add column if not exists channel_suppressions jsonb not null default '{}'::jsonb;
alter table public.growth_leads
  drop constraint if exists growth_leads_channel_suppressions_object;
alter table public.growth_leads
  add constraint growth_leads_channel_suppressions_object
  check (jsonb_typeof(channel_suppressions)='object');
comment on column public.growth_organizations.communication_policy is 'Tenant send-time policy; quiet-hours timezone uses IANA timezone names.';
comment on column public.growth_leads.channel_suppressions is 'Per-contact channel suppression flags; suppressions always override consent.';
