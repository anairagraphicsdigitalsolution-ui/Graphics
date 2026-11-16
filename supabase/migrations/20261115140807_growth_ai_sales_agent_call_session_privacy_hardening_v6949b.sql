-- Remove any earlier member-wide read policy so call SDP and call metadata are manager-only.
drop policy if exists growth_wa_call_sessions_member_select on public.growth_whatsapp_call_sessions;
drop policy if exists growth_wa_call_sessions_select on public.growth_whatsapp_call_sessions;
create policy growth_wa_call_sessions_select
  on public.growth_whatsapp_call_sessions
  for select to authenticated
  using (private.is_growth_manager(organization_id) or public.is_anaira_admin());
