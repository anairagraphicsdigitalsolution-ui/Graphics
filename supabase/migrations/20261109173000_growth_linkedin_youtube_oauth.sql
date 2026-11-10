-- Permit secure OAuth state records for the LinkedIn and YouTube providers.
alter table public.growth_oauth_states
  drop constraint if exists growth_oauth_states_provider_check;

alter table public.growth_oauth_states
  add constraint growth_oauth_states_provider_check
  check (provider in ('meta', 'linkedin', 'youtube'));
