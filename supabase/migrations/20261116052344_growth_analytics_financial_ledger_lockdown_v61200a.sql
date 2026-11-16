-- v6.102.0a: financial ledger writes are API/service-role mediated; authenticated access is read-only.
drop policy if exists growth_marketing_financial_manager_access on public.growth_marketing_financial_entries;
create policy growth_marketing_financial_manager_read on public.growth_marketing_financial_entries
  for select to authenticated
  using (private.is_growth_manager(organization_id));
revoke insert, update, delete on public.growth_marketing_financial_entries from authenticated;
grant select on public.growth_marketing_financial_entries to authenticated;
grant all on public.growth_marketing_financial_entries to service_role;
comment on table public.growth_marketing_financial_entries is
  'Tenant-scoped actual marketing spend, recognized revenue and refunds. Authenticated users have manager-only read access; all writes are mediated by server APIs/service role. Corrections must be represented by auditable entries or controlled server-side reconciliation.';
