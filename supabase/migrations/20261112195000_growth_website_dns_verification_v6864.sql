-- Secure DNS TXT ownership verification for Growth Engine managed websites.
alter table public.growth_websites
  add column if not exists verification_token_hash text,
  add column if not exists verification_checked_at timestamptz,
  add column if not exists verified_at timestamptz;
create index if not exists growth_websites_verification_status_idx
  on public.growth_websites (organization_id, verification_status);
comment on column public.growth_websites.verification_token_hash is 'SHA-256 hash of one-time DNS TXT verification challenge; plaintext token is never stored.';
