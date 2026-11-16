-- Restrict call SDP, caller metadata and transcript-bearing session records to managers.
-- Service-role webhook processing remains available to trusted server code.
drop policy if exists growth_wa_call_sessions_select on public.growth_whatsapp_call_sessions;
create policy growth_wa_call_sessions_select
  on public.growth_whatsapp_call_sessions
  for select to authenticated
  using (private.is_growth_manager(organization_id) or public.is_anaira_admin());
