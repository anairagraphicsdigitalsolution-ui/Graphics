-- Supports workspace-scoped customer retention task dashboards and due-date reporting.
create index if not exists growth_tasks_retention_due_idx
  on public.growth_tasks (organization_id, task_type, status, due_at)
  where task_type in ('retention', 'renewal', 'feedback', 'review');
