-- Adds stable external identity for Instagram DM and Facebook Messenger contacts.
-- Applied to Anaira's connected production Supabase project.
alter table public.growth_leads add column if not exists external_contact_id text;
create unique index if not exists growth_leads_social_contact_unique
  on public.growth_leads(organization_id, source, external_contact_id)
  where external_contact_id is not null;
