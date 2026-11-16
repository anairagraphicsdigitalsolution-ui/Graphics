-- v6.112.0: approval-gated execution ledger for AI Command Center actions.
create table if not exists public.growth_command_actions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.growth_organizations(id) on delete cascade,
  action_type text not null check (action_type in ('create_task')),
  title text not null check (char_length(title) between 1 and 160),
  description text not null default '' check (char_length(description) <= 2000),
  due_at timestamptz,
  status text not null default 'pending_approval' check (status in ('pending_approval','approved','rejected','executed','failed')),
  created_by uuid not null,
  approved_by uuid,
  approved_at timestamptz,
  executed_by uuid,
  executed_at timestamptz,
  result jsonb not null default '{}'::jsonb,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists growth_command_actions_org_status_created_idx
  on public.growth_command_actions (organization_id, status, created_at desc);
alter table public.growth_command_actions enable row level security;
revoke all on public.growth_command_actions from anon, authenticated;
grant all on public.growth_command_actions to service_role;
