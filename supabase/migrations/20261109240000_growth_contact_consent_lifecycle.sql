alter table public.growth_leads
 add column if not exists contact_consent_at timestamptz,
 add column if not exists contact_consent_source text,
 add column if not exists contact_consent_method text,
 add column if not exists contact_opted_out_at timestamptz,
 add column if not exists contact_opt_out_source text;
create index if not exists growth_leads_org_optout_idx
 on public.growth_leads(organization_id,contact_opted_out_at)
 where contact_opted_out_at is not null;
