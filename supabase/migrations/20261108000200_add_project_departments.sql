-- Anaira CMS: add editable departments for every portfolio area.
alter table public.projects
  add column if not exists department text not null default 'graphics';

update public.projects set department = case
  when kind in ('product','client-software') then 'software'
  when kind = 'website' then 'websites'
  when kind = 'creative' then 'graphics'
  else coalesce(department, 'graphics')
end
where department is null or department = 'graphics';

-- Keep existing project kinds for backwards compatibility; department controls
-- which Admin section owns the item and where it appears in the public portfolio.
