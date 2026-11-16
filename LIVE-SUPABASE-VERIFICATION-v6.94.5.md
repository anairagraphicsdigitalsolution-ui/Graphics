# Live Supabase Verification — Anaira AI Growth Engine v6.94.5

Date: 2026-11-15
Project: Anaira Graphics & Digital Solution
Project ref: `nrsdqrqkffhbicfskilb`
Branch: `main` (PRODUCTION)
Region: `ap-northeast-1`

## Applied migrations

The following migrations were applied to the confirmed project using the Supabase migration operation. The Supabase migration history recorded each successful application:

- `growth_knowledge_documents_v6906`
- `growth_knowledge_office_formats_v6907`
- `growth_platform_integrations_v6923`
- `growth_external_effect_reconciliation_v6932`
- `growth_external_effect_reconciliation_audit_v6933`
- `growth_invoice_ledger_service_role_lockdown_v6937`
- `growth_channel_specific_consent_v6939`
- `growth_send_policy_v6940`
- `growth_contact_suppression_controls_v6941`
- `growth_knowledge_semantic_retrieval_v6944`
- `growth_prospect_verification_autopilot_v6920`
- `growth_google_ads_attribution_metering_v6924`

## Live catalog verification

Read-only catalog queries confirmed:

- `public.growth_knowledge_documents` exists and RLS is enabled.
- `public.growth_knowledge_chunks` exists and RLS is enabled.
- `public.growth_platform_integrations` exists and RLS is enabled.
- `public.growth_external_effect_reconciliations` exists and RLS is enabled.
- `public.growth_manual_payments` and `public.growth_invoices` have RLS enabled.
- Knowledge chunks include `embedding`, `embedding_model`, and `embedded_at`.
- PostgreSQL `vector` extension is installed.
- `public.match_growth_knowledge_chunks`, `public.growth_set_lead_channel_consent`, `public.growth_set_lead_channel_suppression`, and `public.resolve_growth_external_effect_job` exist.
- Storage bucket `growth-knowledge-private` exists with `public = false` and 10 MiB file-size limit.

## Source verification

- `npm run verify:all`: exit 0; all included checks passed (1,138 PASS assertions reported across the suite; no failing assertions).
- TypeScript syntax scan: 207 TS/TSX files; 0 syntax errors.
- `npm run audit:growth-migrations`: exit 0; static audit completed.

## Remaining blockers / limitations

- `npm run preflight:growth-production` is blocked because there is no `package-lock.json`, Next.js is not installed in this workspace, and no local production env file is present.
- `npm run build` cannot run: `next: not found`.
- Live provider authentication/certification (OpenAI, Meta, WhatsApp, Google Ads, Google CSE, Resend, Twilio, LinkedIn, YouTube) has not been performed.
- Existing Knowledge Hub documents still need embedding backfill; the v6.94.5 re-index endpoint is included in source, but live provider-backed backfill was not run because provider credentials and user approval for usage/cost are not available here.
- Full browser E2E, adversarial cross-tenant tests, scheduler/load/recovery drills, and backup/restore certification remain outstanding.

This report distinguishes live database migration/catalog checks from source-level verification. It does not claim full production certification.
