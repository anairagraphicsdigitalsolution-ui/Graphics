-- v6.114.0 / Function 7: record human outcome feedback against an executed action.
create table if not exists public.growth_command_action_feedback (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.growth_organizations(id) on delete cascade,
  action_id uuid not null references public.growth_command_actions(id) on delete cascade,
  task_id uuid not null references public.growth_tasks(id) on delete cascade,
  feedback_type text not null check (feedback_type in ('positive','negative','neutral')),
  rating smallint check (rating is null or rating between 1 and 5),
  notes text check (notes is null or char_length(notes) <= 1200),
  created_by uuid not null,
  created_at timestamptz not null default now()
);
create index if not exists growth_command_action_feedback_org_action_created_idx
  on public.growth_command_action_feedback (organization_id, action_id, created_at desc);
create index if not exists growth_command_action_feedback_org_created_idx
  on public.growth_command_action_feedback (organization_id, created_at desc);
alter table public.growth_command_action_feedback enable row level security;
revoke all on public.growth_command_action_feedback from anon, authenticated;
grant all on public.growth_command_action_feedback to service_role;
