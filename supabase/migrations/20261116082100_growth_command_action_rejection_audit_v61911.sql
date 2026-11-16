-- v6.113.0: preserve rejection actor/time separately from approval metadata.
alter table public.growth_command_actions
  add column if not exists rejected_by uuid,
  add column if not exists rejected_at timestamptz;
