# Anaira AI Growth Engine v6.79.7 — CRM Sales Attribution

## Added
- Independent CRM Sales Attribution report at `/admin/ai-growth/crm/reports`.
- Workspace membership selection and tenant-scoped lead reads through Supabase RLS.
- Lead source grouping with UTM source preferred over CRM source.
- Won/lost/open pipeline counts and lead-to-won conversion.
- Won value sums only explicit `deal_value`, `expected_revenue`, or `value` fields.
- CSV export and CRM navigation link.

## Boundaries
- This is CRM-record attribution, not ad-platform spend attribution or multi-touch attribution.
- Revenue is not inferred when the lead record has no explicit value.
- Cashfree live, social provider E2E, email inbound lifecycle and true graph workflow execution remain separate pending work.
