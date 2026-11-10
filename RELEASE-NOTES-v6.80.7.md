# Anaira AI Growth Engine v6.80.7

## CRM bulk operations
- Added a tenant-scoped bulk lead update API for status and lead temperature.
- Restricted operation to workspace owners/managers and CRM-entitled plans.
- Validates UUIDs, limits each batch to 100 leads, rejects cross-tenant/missing IDs, and only accepts allow-listed values.
- Writes per-lead CRM activity timeline entries for changed fields.
- Added regression checks to `verify:all`.

## Scope protection
- No main portfolio website pages or general Website Settings changed.
- No schema migration required; uses existing `growth_leads` and `growth_lead_activities` tables.

## Release limitations
This is an incremental completion release, not full SaaS completion or production certification. Graph-based parallel workflows, provider live E2E, advanced billing, advanced CRM attribution/forecasting, tenant lifecycle, full security certification and production build remain open.
