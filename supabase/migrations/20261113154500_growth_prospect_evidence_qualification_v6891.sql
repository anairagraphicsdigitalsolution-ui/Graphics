-- Evidence-backed prospect qualification. Fit and demonstrated buying intent are stored separately.
alter table public.growth_prospects
  add column if not exists qualification_status text not null default 'unreviewed'
    check (qualification_status in ('unreviewed','qualified','nurture','disqualified','needs_review'));
alter table public.growth_prospects
  add column if not exists intent_score integer not null default 0
    check (intent_score between 0 and 100);
alter table public.growth_prospects
  add column if not exists qualification_evidence jsonb not null default '{}'::jsonb;
alter table public.growth_prospects
  add column if not exists qualified_at timestamptz;
create index if not exists growth_prospects_org_qualification_idx
  on public.growth_prospects(organization_id, qualification_status, intent_score desc, created_at desc);
