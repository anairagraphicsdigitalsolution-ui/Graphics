# Release Gate v6.89.2

- Prospect discovery pagination: present from v6.89.0.
- Evidence-based prospect qualification: present from v6.89.1.
- Prospect-to-CRM conversion: added in v6.89.2.
- Conversion is workspace-scoped, role-checked, CRM-entitlement-checked, quota-metered and idempotent.
- Consent is never inferred or transferred during conversion.
- Supabase migration applied successfully; schema verification and static regression checks required for this release.

Still not production-certified: clean dependency install/build, authenticated live E2E, two-tenant RLS penetration tests, live provider sends/publishes/calls, WhatsApp-native media/signalling, production worker/cron, backup/restore/load drills and full revenue attribution.
