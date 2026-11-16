create table if not exists public.growth_email_templates (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null references public.growth_organizations(id) on delete cascade,
 name text not null check(char_length(btrim(name)) between 2 and 120),
 subject text not null check(char_length(btrim(subject)) between 1 and 180),
 body_text text not null check(char_length(btrim(body_text)) between 1 and 10000),
 is_active boolean not null default true,
 created_by uuid references auth.users(id) on delete set null,
 updated_by uuid references auth.users(id) on delete set null,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(organization_id,name)
);
create index if not exists growth_email_templates_org_active_idx on public.growth_email_templates(organization_id,is_active,updated_at desc);
alter table public.growth_email_templates enable row level security;
drop policy if exists growth_email_templates_member_read on public.growth_email_templates;
create policy growth_email_templates_member_read on public.growth_email_templates for select to authenticated using(private.is_growth_member(organization_id) or public.is_anaira_admin());
drop policy if exists growth_email_templates_editor_insert on public.growth_email_templates;
create policy growth_email_templates_editor_insert on public.growth_email_templates for insert to authenticated with check((private.is_growth_member(organization_id) and exists(select 1 from public.growth_members m where m.organization_id=growth_email_templates.organization_id and m.user_id=(select auth.uid()) and m.role in ('owner','manager','editor'))) or public.is_anaira_admin());
drop policy if exists growth_email_templates_editor_update on public.growth_email_templates;
create policy growth_email_templates_editor_update on public.growth_email_templates for update to authenticated using((private.is_growth_member(organization_id) and exists(select 1 from public.growth_members m where m.organization_id=growth_email_templates.organization_id and m.user_id=(select auth.uid()) and m.role in ('owner','manager','editor'))) or public.is_anaira_admin()) with check((private.is_growth_member(organization_id) and exists(select 1 from public.growth_members m where m.organization_id=growth_email_templates.organization_id and m.user_id=(select auth.uid()) and m.role in ('owner','manager','editor'))) or public.is_anaira_admin());
revoke all on public.growth_email_templates from public,anon,authenticated;
grant select,insert,update on public.growth_email_templates to authenticated;
grant all on public.growth_email_templates to service_role;
