-- Extend the existing approved retention touchpoint queue to channel-specific dispatch.
-- No existing email records are rewritten; historical rows keep channel='email'.
alter table public.growth_retention_touchpoints
  drop constraint if exists growth_retention_touchpoints_channel_check;
alter table public.growth_retention_touchpoints
  add constraint growth_retention_touchpoints_channel_check
  check (channel in ('email','whatsapp','sms'));

alter table public.growth_retention_touchpoints
  add column if not exists template_id uuid references public.growth_whatsapp_templates(id) on delete set null;

create index if not exists growth_retention_touchpoints_org_channel_status_idx
  on public.growth_retention_touchpoints(organization_id,channel,status,scheduled_at asc);

comment on column public.growth_retention_touchpoints.template_id is
  'Approved tenant-owned WhatsApp template used for this retention touchpoint; worker rechecks approval before dispatch.';

comment on table public.growth_retention_touchpoints is
  'Customer retention outreach drafts and approval lifecycle for email, approved WhatsApp templates and SMS. Provider workers recheck channel consent, suppression and workspace send policy immediately before dispatch.';
