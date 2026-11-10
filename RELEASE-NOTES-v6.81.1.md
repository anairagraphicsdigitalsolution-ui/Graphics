# Anaira AI Growth Engine v6.81.1 — Stable Navigation & Manual Billing

## Navigation and speed
- Added one shared primary navigation component for Overview, CRM, Content, Tasks, Campaigns, AI Employee, Automation, Channels, Analytics, Team, Plan & Usage and Super Admin billing.
- Shared navigation uses Next.js client-side links with prefetch.
- Applied the same navigation to dashboard, CRM, CRM reports, team, platform admin, workspace billing and platform billing.
- Dashboard queries only the data sets required by the selected page instead of loading all five modules on every route.
- Replaced broad lead/content/task/campaign selections with narrow field projections.

## Manual payment collection
- Added service-role-only ledger tables for manual payments and invoices.
- Platform admins can record Cash, UPI or Bank Transfer payments against a workspace with an assigned subscription.
- UPI requires a UTR / transaction reference.
- Saving a confirmed payment creates an invoice/receipt, activates the assigned subscription, writes an audit event and exposes payment/invoice history.
- Invoice can be printed or saved as PDF from the browser.
- Workspace Plan & Usage shows Cashfree online checkout separately from offline payment instructions; workspace users cannot self-mark offline payments as paid.

## Database
- New migration: `20261111100000_growth_manual_billing_invoices_v6811.sql`
- This migration must be applied to the connected Supabase project before manual payment collection is used.

## Important billing note
The generated document is a payment receipt / basic invoice. It is not a GST-compliant tax invoice until legal seller name, address, GSTIN, place-of-supply and tax configuration are supplied and validated.

## Validation
- Full `verify:all` passed.
- Manual billing checks: 10/10.
- Navigation/performance checks: 9/9 (includes shared navigation surfaces).
- TypeScript/TSX syntax scan: 134 files, 0 syntax errors.
- Production build and live Supabase migration application were not performed in this environment.
