# Anaira AI Growth Engine v6.80.5

## SaaS feature entitlement enforcement

- Added shared `requireGrowthFeature` resolver.
- Platform administrators can operate across tenant plans.
- Tenant feature access resolves the active subscription and its plan; expired, paused, cancelled or past-due subscriptions do not receive feature access through the subscription path.
- Explicit `false` feature flags deny access; missing flags preserve existing legacy-plan behavior to avoid unexpectedly locking existing tenants.
- Added Super Admin plan module toggles for CRM, AI Employee, Workflow Automation, WhatsApp, Social Channels and Ads Manager.
- Enforced feature gates on workflow APIs, WhatsApp outbound, social OAuth, Meta ad activation, CRM lead updates, tasks, imports, activities, attachments and analytics.
- Added 15 feature entitlement regression checks.

## Verification
- `npm run verify:all`: PASS.
- Source syntax scan: PASS.
- Feature entitlement checks: 15/15.
- Workflow DLQ checks: 7/7.
- Workflow engine checks: 17/17.
- ZIP integrity: PASS.

## Important limitations
- Legacy plan feature keys that are absent remain enabled for backward compatibility; explicitly disabled keys are enforced.
- This release does not complete graph-based parallel workflow execution, tenant creation/owner transfer, recurring billing/refunds/GST, advanced ROI attribution, live Meta/WhatsApp/Resend/Cashfree tests, or full security certification.
- No Supabase schema migration is required for this release; plan features already use `growth_plans.features`.
- Production build still requires a clean dependency installation and CI/Vercel verification.

Main portfolio pages and general Website Settings were not modified.
