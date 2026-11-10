-- Anaira AI Growth Engine v6.75.7: FK indexing and least-privilege RPC hardening.
-- The three RLS-enabled/no-policy tables are intentionally service-role-only.
create index if not exists growth_ad_activation_audit_campaign_draft_idx on public.growth_ad_activation_audit(campaign_draft_id);
create index if not exists growth_ad_drafts_adset_draft_idx on public.growth_ad_drafts(adset_draft_id);
create index if not exists growth_ad_drafts_creative_draft_idx on public.growth_ad_drafts(creative_draft_id);
create index if not exists growth_adset_drafts_campaign_draft_idx on public.growth_adset_drafts(campaign_draft_id);
create index if not exists growth_conversations_assigned_to_idx on public.growth_conversations(assigned_to);
create index if not exists growth_leads_assigned_to_idx on public.growth_leads(assigned_to);
create index if not exists growth_oauth_states_organization_idx on public.growth_oauth_states(organization_id);
create index if not exists growth_oauth_states_user_idx on public.growth_oauth_states(user_id);
create index if not exists growth_tasks_assigned_to_idx on public.growth_tasks(assigned_to);
create index if not exists growth_tasks_created_by_idx on public.growth_tasks(created_by);
create index if not exists growth_webhook_events_organization_idx on public.growth_webhook_events(organization_id);
create index if not exists growth_workflow_runs_lead_idx on public.growth_workflow_runs(lead_id);
create index if not exists growth_workflow_runs_rule_idx on public.growth_workflow_runs(rule_id);

-- This helper is intentionally callable by authenticated users because it is
-- used by RLS policies, but it must never be callable by anonymous visitors.
revoke all on function public.is_anaira_admin() from public, anon;
grant execute on function public.is_anaira_admin() to authenticated, service_role;

-- Event-trigger helper is not an application RPC endpoint.
revoke all on function public.rls_auto_enable() from public, anon, authenticated;
grant execute on function public.rls_auto_enable() to service_role;
