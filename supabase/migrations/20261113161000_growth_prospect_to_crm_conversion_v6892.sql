-- Idempotent, tenant-scoped bridge from researched prospects into CRM.
alter table public.growth_leads
  add column if not exists source_prospect_id uuid references public.growth_prospects(id) on delete set null;
create unique index if not exists growth_leads_org_source_prospect_uidx
  on public.growth_leads(organization_id, source_prospect_id)
  where source_prospect_id is not null;
create index if not exists growth_prospects_org_conversion_idx
  on public.growth_prospects(organization_id, status, created_at desc);
