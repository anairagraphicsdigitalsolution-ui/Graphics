-- Anaira AI Growth Engine v6.79.9: close remaining FK index gaps reported by Performance Advisor.
-- Safe to re-run: every index is created with IF NOT EXISTS.
create index if not exists growth_lead_attachments_lead_idx
  on public.growth_lead_attachments(lead_id);
create index if not exists growth_payment_transactions_plan_idx
  on public.growth_payment_transactions(plan_id);
create index if not exists growth_workflow_run_events_run_idx
  on public.growth_workflow_run_events(run_id);
create index if not exists growth_workflow_versions_created_by_idx
  on public.growth_workflow_versions(created_by);
