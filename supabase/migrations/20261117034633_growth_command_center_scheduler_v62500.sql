-- v6.120.0 / Function 12: recurring Command Center alert scans and management summaries.
alter table public.growth_autonomous_schedules
  drop constraint if exists growth_autonomous_schedules_schedule_type_check;
alter table public.growth_autonomous_schedules
  add constraint growth_autonomous_schedules_schedule_type_check
  check (schedule_type in ('prospect_discovery','campaign_analysis','google_ads_analysis','daily_briefing_delivery','command_alert_scan','command_center_summary'));

create index if not exists growth_autonomous_schedules_command_center_due_idx
  on public.growth_autonomous_schedules (next_run_at, organization_id)
  where enabled = true and schedule_type in ('command_alert_scan','command_center_summary');

comment on column public.growth_autonomous_schedules.schedule_type is
  'Includes recurring command_alert_scan and command_center_summary internal governance schedules.';
