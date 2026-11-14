-- Keep persisted CRM stages aligned with the 13-stage pipeline used by the UI/APIs.
-- The previous constraint allowed only five values, so several valid UI transitions
-- (discovered, enriched, interested, meeting_scheduled, proposal, negotiation,
-- contact_pending and follow_up_later) could be rejected by Postgres.
alter table public.growth_leads drop constraint if exists growth_leads_status_check;
alter table public.growth_leads add constraint growth_leads_status_check check (
  status = any (array[
    'new','discovered','enriched','qualified','contact_pending','contacted',
    'interested','meeting_scheduled','proposal','negotiation','follow_up_later',
    'won','lost'
  ]::text[])
);
create index if not exists growth_leads_org_status_updated_idx
  on public.growth_leads(organization_id,status,updated_at desc);
