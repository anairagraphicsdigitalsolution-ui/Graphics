alter table public.growth_conversations add column if not exists assigned_to uuid references auth.users(id) on delete set null;
alter table public.growth_conversations add column if not exists needs_human boolean not null default false;
alter table public.growth_conversations add column if not exists last_message_at timestamptz not null default now();
create index if not exists growth_conversations_inbox_idx on public.growth_conversations(organization_id,last_message_at desc);
