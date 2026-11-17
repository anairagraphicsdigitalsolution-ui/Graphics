-- Performance-only RLS policy rewrite: evaluate auth and membership helpers once per statement.
drop policy if exists growth_strategy_member_select on public.growth_strategy_plans;
create policy growth_strategy_member_select on public.growth_strategy_plans
for select to authenticated
using (exists (select 1 from public.growth_members m where m.organization_id = growth_strategy_plans.organization_id and m.user_id = (select auth.uid())));

drop policy if exists growth_prospects_member_select on public.growth_prospects;
create policy growth_prospects_member_select on public.growth_prospects
for select to authenticated
using (exists (select 1 from public.growth_members m where m.organization_id = growth_prospects.organization_id and m.user_id = (select auth.uid())));

drop policy if exists growth_autonomous_schedules_manager_write on public.growth_autonomous_schedules;
create policy growth_autonomous_schedules_manager_write on public.growth_autonomous_schedules
for all to authenticated
using (exists (select 1 from public.growth_members m where m.organization_id = growth_autonomous_schedules.organization_id and m.user_id = (select auth.uid()) and m.role = any (array['owner'::text,'manager'::text])) or (select public.is_anaira_admin()))
with check (exists (select 1 from public.growth_members m where m.organization_id = growth_autonomous_schedules.organization_id and m.user_id = (select auth.uid()) and m.role = any (array['owner'::text,'manager'::text])) or (select public.is_anaira_admin()));

drop policy if exists growth_seo_keywords_tenant_insert on public.growth_seo_keywords;
create policy growth_seo_keywords_tenant_insert on public.growth_seo_keywords
for insert to authenticated
with check (((select private.is_growth_member(organization_id)) and exists (select 1 from public.growth_members m where m.organization_id = growth_seo_keywords.organization_id and m.user_id = (select auth.uid()) and m.role = any (array['owner'::text,'manager'::text,'editor'::text]))) or (select public.is_anaira_admin()));

drop policy if exists growth_seo_keywords_tenant_update on public.growth_seo_keywords;
create policy growth_seo_keywords_tenant_update on public.growth_seo_keywords
for update to authenticated
using (((select private.is_growth_member(organization_id)) and exists (select 1 from public.growth_members m where m.organization_id = growth_seo_keywords.organization_id and m.user_id = (select auth.uid()) and m.role = any (array['owner'::text,'manager'::text,'editor'::text]))) or (select public.is_anaira_admin()))
with check (((select private.is_growth_member(organization_id)) and exists (select 1 from public.growth_members m where m.organization_id = growth_seo_keywords.organization_id and m.user_id = (select auth.uid()) and m.role = any (array['owner'::text,'manager'::text,'editor'::text]))) or (select public.is_anaira_admin()));

drop policy if exists growth_seo_tasks_tenant_insert on public.growth_seo_tasks;
create policy growth_seo_tasks_tenant_insert on public.growth_seo_tasks
for insert to authenticated
with check (((select private.is_growth_member(organization_id)) and exists (select 1 from public.growth_members m where m.organization_id = growth_seo_tasks.organization_id and m.user_id = (select auth.uid()) and m.role = any (array['owner'::text,'manager'::text,'editor'::text]))) or (select public.is_anaira_admin()));
