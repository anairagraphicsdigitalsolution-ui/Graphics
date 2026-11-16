revoke all on table public.growth_seo_keywords, public.growth_seo_search_metrics, public.growth_seo_analytics_metrics, public.growth_seo_tasks from anon, authenticated;
grant select,insert,update on table public.growth_seo_keywords to authenticated;
grant select on table public.growth_seo_search_metrics, public.growth_seo_analytics_metrics to authenticated;
grant select,insert,update on table public.growth_seo_tasks to authenticated;
grant all on table public.growth_seo_keywords, public.growth_seo_search_metrics, public.growth_seo_analytics_metrics, public.growth_seo_tasks to service_role;
