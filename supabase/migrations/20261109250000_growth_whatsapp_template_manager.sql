create table if not exists public.growth_whatsapp_templates (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null references public.growth_organizations(id) on delete cascade,
 template_name text not null check (template_name ~ '^[a-z0-9_]{3,512}$'),
 language text not null default 'en' check (char_length(language) between 2 and 16),
 category text not null default 'UTILITY' check (category in ('UTILITY','MARKETING','AUTHENTICATION')),
 body_text text not null check (char_length(body_text) between 1 and 1024),
 variables jsonb not null default '[]'::jsonb check (jsonb_typeof(variables)='array'),
 approval_status text not null default 'draft' check (approval_status in ('draft','pending','approved','rejected','paused')),
 provider_template_id text,
 provider_status_checked_at timestamptz,
 approval_confirmed_by uuid,
 approval_note text,
 created_by uuid,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(organization_id,template_name,language)
);
create index if not exists growth_whatsapp_templates_org_status_idx
 on public.growth_whatsapp_templates(organization_id,approval_status,template_name);
alter table public.growth_whatsapp_templates enable row level security;
revoke all on public.growth_whatsapp_templates from anon,authenticated,public;
grant all on public.growth_whatsapp_templates to service_role;
