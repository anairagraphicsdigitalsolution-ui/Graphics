# Live Supabase verification — v6.79.9

Project: Anaira Graphics & Digital Solution  
Project ref: `nrsdqrqkffhbicfskilb`  
Region: `ap-northeast-1`

## Completed

- Confirmed the project is ACTIVE_HEALTHY.
- Confirmed the existing Growth Engine schema includes `growth_payment_transactions`, `growth_payment_webhook_events`, and `growth_lead_attachments`.
- Applied migration `growth_engine_fk_index_hardening_v6798` (recorded as migration version `20261109181037`).
- Verified all four new indexes through `pg_indexes`:
  - `growth_lead_attachments_lead_idx`
  - `growth_payment_transactions_plan_idx`
  - `growth_workflow_run_events_run_idx`
  - `growth_workflow_versions_created_by_idx`

## Findings requiring dashboard or architectural work

- Enable leaked password protection in Supabase Auth settings.
- Review the authenticated-executable `public.is_anaira_admin()` SECURITY DEFINER helper. It is currently required by RLS policies; changing its privileges without replacing dependent policies can break authorization.
- RLS-enabled tables with no policies are intentionally service-role-only; do not add broad authenticated policies just to silence the INFO advisor.
- Unused-index notices need workload observation before removal.

## Not tested

- Real customer sign-in and cross-tenant negative tests.
- Meta/WhatsApp/LinkedIn/YouTube production OAuth and webhook delivery.
- Cashfree sandbox/live payment, refund, and settlement.
- Vercel production deployment and Next.js production build.
