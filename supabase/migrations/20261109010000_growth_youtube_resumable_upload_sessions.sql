create table if not exists public.growth_youtube_upload_sessions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  content_id uuid not null,
  social_account_id uuid not null,
  encrypted_session_url text not null,
  mime_type text not null,
  total_bytes bigint not null check (total_bytes > 0 and total_bytes <= 83886080),
  uploaded_bytes bigint not null default 0 check (uploaded_bytes >= 0 and uploaded_bytes <= total_bytes),
  provider_video_id text,
  status text not null default 'initiated' check (status in ('initiated','uploading','uploaded','expired','failed')),
  last_error text,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, content_id)
);
create index if not exists growth_youtube_upload_sessions_status_idx
  on public.growth_youtube_upload_sessions (status, updated_at desc);
alter table public.growth_youtube_upload_sessions enable row level security;
revoke all on table public.growth_youtube_upload_sessions from anon, authenticated;
grant select, insert, update, delete on table public.growth_youtube_upload_sessions to service_role;
