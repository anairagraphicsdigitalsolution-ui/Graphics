-- v6.107.0: add tenant-controlled daily internal briefing email schedules.
alter table public.growth_autonomous_schedules
  drop constraint if exists growth_autonomous_schedules_schedule_type_check;
alter table public.growth_autonomous_schedules
  add constraint growth_autonomous_schedules_schedule_type_check
  check (schedule_type in ('prospect_discovery','campaign_analysis','google_ads_analysis','daily_briefing_delivery'));

-- Delivery remains a service-role worker action. Authenticated users manage schedules
-- through the existing owner/manager RLS policy; recipients are stored in schedule config.
create index if not exists growth_autonomous_schedule_briefing_due_idx
  on public.growth_autonomous_schedules(next_run_at)
  where enabled=true and schedule_type='daily_briefing_delivery';
