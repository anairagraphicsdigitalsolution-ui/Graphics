drop policy if exists growth_seo_tasks_tenant_update on public.growth_seo_tasks;
create policy growth_seo_tasks_tenant_update on public.growth_seo_tasks
for update to authenticated
using (((select private.is_growth_member(organization_id)) and exists (select 1 from public.growth_members m where m.organization_id = growth_seo_tasks.organization_id and m.user_id = (select auth.uid()) and m.role = any (array['owner'::text,'manager'::text,'editor'::text]))) or (select public.is_anaira_admin()))
with check (((select private.is_growth_member(organization_id)) and exists (select 1 from public.growth_members m where m.organization_id = growth_seo_tasks.organization_id and m.user_id = (select auth.uid()) and m.role = any (array['owner'::text,'manager'::text,'editor'::text]))) or (select public.is_anaira_admin()));
