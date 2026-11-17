-- Drop the later duplicate of the existing organization/status/created_at index.
drop index if exists public.growth_prospects_org_conversion_idx;
