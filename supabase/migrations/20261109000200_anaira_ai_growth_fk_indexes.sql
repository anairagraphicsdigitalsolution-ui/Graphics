-- Cover every foreign key in the AI Growth Engine for predictable joins/deletes.
create index if not exists growth_agents_org_idx on public.growth_agents(organization_id);
create index if not exists growth_agents_website_idx on public.growth_agents(website_id);
create index if not exists growth_automation_rules_org_idx on public.growth_automation_rules(organization_id);
create index if not exists growth_campaigns_org_idx on public.growth_campaigns(organization_id);
create index if not exists growth_content_social_account_idx on public.growth_content(social_account_id);
create index if not exists growth_conversations_agent_idx on public.growth_conversations(agent_id);
create index if not exists growth_conversations_website_idx on public.growth_conversations(website_id);
create index if not exists growth_leads_conversation_idx on public.growth_leads(conversation_id);
create index if not exists growth_leads_website_idx on public.growth_leads(website_id);
create index if not exists growth_social_accounts_org_idx on public.growth_social_accounts(organization_id);
create index if not exists growth_usage_logs_org_idx on public.growth_usage_logs(organization_id);
