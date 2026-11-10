# Anaira AI Growth Engine v6.81.5 — Credit Ledger & Payment Balance

- Added a per-workspace agreed credit/contract ceiling (`credit_limit_minor`).
- Confirmed manual payment ledger entries are aggregated as paid amounts.
- Outstanding balance is calculated as `max(credit limit - confirmed payments, 0)`.
- Super Admin can set the agreed credit amount while assigning/changing a subscription and sees paid / balance due per tenant.
- Workspace Plan & Usage now displays agreed amount, total paid, outstanding amount and payment history.
- Existing payment records are not modified; only confirmed payments count toward paid totals.

## Database
Apply `supabase/migrations/20261111110000_growth_credit_ledger_v6815.sql` before using credit balances. Historical payments already present in `growth_manual_payments` are included automatically. If the ₹48,000 was never recorded in that ledger, Super Admin must record it as a verified payment; the app will not fabricate a receipt.
