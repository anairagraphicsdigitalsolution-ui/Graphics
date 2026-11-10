# Anaira AI Growth Engine v6.81.6

## Sales report and billing UI refinement
- Reworked CRM Sales Performance report into a responsive KPI + source-performance dashboard while retaining CSV export and the existing source attribution calculations.
- Improved Super Admin billing overview with contract value, confirmed receipts, outstanding amount and active subscription summary.
- Improved Client Manager Plan & Usage credit ledger presentation with agreed amount, paid-to-date, balance remaining, payment status and payment history.
- Corrected paid-payment aggregation to be subscription-scoped rather than organization-scoped, preventing one subscription's receipts from being counted against another subscription for the same organization.
- Existing database schema is reused; no new migration is introduced.

## Verification
- `verify:growth-sales-billing-ui` checks layout hooks, payment history, responsive styles and subscription-scoped balance aggregation.
- Live Supabase records and production deployment are not verified by source checks.
