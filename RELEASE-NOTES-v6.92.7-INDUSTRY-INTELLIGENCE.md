# Anaira AI Growth Engine v6.92.7 — Industry Intelligence

## Implemented in this source update
- Added tenant-selectable industry playbooks for hospitality, restaurants, healthcare, retail/e-commerce, real estate, education, travel, professional services, manufacturing/distribution, agencies and custom/other businesses.
- Playbooks define industry-specific customer journeys, KPI definitions to request from the AI planner, qualification signals and channel suggestions.
- Growth Intelligence loads the current workspace industry and allows an owner/manager to select and persist the workspace industry when generating a strategy.
- Strategy generation now includes the selected industry playbook and asks for a stage-based customer journey and KPI definitions, including whether required data is available or missing.
- Explicitly prohibits invented industry benchmarks and keeps strategies in draft; this does not launch campaigns or send outreach.
- Reuses the existing `growth_organizations.industry` column; no database migration is required for this change.

## Verification
- `scripts/verify-growth-industry-playbooks-v6927.cjs` covers the industry catalogue, UI wiring, tenant industry persistence, prompt grounding and authorization.
- Full configured verification suite results are recorded in `VERIFICATION-v6.92.7.log`.

## Not certified by this update
This is a source implementation increment, not a 100% production certification. Live provider E2E, dedicated Supabase migration/RLS audit, clean dependency install and production build must be verified in the target deployment environment.
