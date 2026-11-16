-- Add loyalty campaign messaging as a supported retention touchpoint type.
alter table public.growth_retention_touchpoints drop constraint if exists growth_retention_touchpoints_touchpoint_type_check;
alter table public.growth_retention_touchpoints add constraint growth_retention_touchpoints_touchpoint_type_check
  check (touchpoint_type in ('repeat_purchase','feedback','review','reactivation','renewal','loyalty'));
