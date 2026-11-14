# Live Supabase Verification — v6.89.8

Project: Anaira AI Growth Engine (connected `Mine Own` project)

Migration: `growth_customer_retention_task_index_v6898`
Version: `20261113174852`

Result: apply succeeded.

Verified index:

`growth_tasks_retention_due_idx`

Definition:

`CREATE INDEX growth_tasks_retention_due_idx ON public.growth_tasks USING btree (organization_id, task_type, status, due_at) WHERE (task_type = ANY (ARRAY['retention', 'renewal', 'feedback', 'review']))`

The existing `growth_tasks` and `growth_lead_activities` tables are reused; no table grants or RLS policies were broadened.
