-- Anaira Portfolio: richer project case studies and image galleries
alter table public.projects
  add column if not exists gallery_images jsonb not null default '[]'::jsonb,
  add column if not exists industry text not null default '',
  add column if not exists client_name text not null default '',
  add column if not exists project_year text not null default '',
  add column if not exists duration text not null default '',
  add column if not exists role text not null default '',
  add column if not exists challenge text not null default '',
  add column if not exists solution text not null default '',
  add column if not exists key_features jsonb not null default '[]'::jsonb,
  add column if not exists outcomes jsonb not null default '[]'::jsonb,
  add column if not exists testimonial text not null default '';
