# Anaira AI Growth Engine v6.103.0 — Module 13 Customer Retention

## Delivered

- Added a tenant-scoped Customer Retention Center at `/admin/ai-growth/retention`.
- Segments Won customers by days since last recorded CRM activity: Engaged (0–30 days), At Risk (31–60 days), Dormant (61+ days). When no activity exists, the lead creation timestamp is used. This is an engagement-recency heuristic, not a predictive churn model.
- Added scheduled retention email touchpoint drafts for repeat-purchase, feedback, review, reactivation, renewal and loyalty campaign use cases.
- Added human approval and cancellation controls. Drafts are never sent automatically.
- Approval checks current email address, global consent, explicit email-channel consent, global opt-out, per-channel suppression, bounce and complaint state.
- Approved touchpoints enqueue an idempotent `send_email` worker job. The existing worker rechecks consent, suppression, deliverability and workspace communication/quiet-hours policy immediately before provider dispatch.
- Worker success/failure updates the touchpoint lifecycle and CRM timeline.
- Hardened Review Center email requests: they must match exactly one CRM contact with explicit email consent and are queued through the worker instead of calling the email provider directly.
- Preserved the existing 7/30/60/90-day internal retention task sequence and its task history.

## Supabase

Migrations:
- `20261116054726_growth_customer_retention_outreach_v61300`
- `20261116054840_growth_retention_loyalty_touchpoint_v61300a`

- Creates `growth_retention_touchpoints` with tenant/customer foreign keys, allowed touchpoint types, email-only channel, lifecycle states, schedule, approval actor, job reference and provider outcome fields.
- Enables RLS and revokes direct access from `public`, `anon` and `authenticated`; server-side service role is the only direct writer/reader for this internal queue table.
- Adds schedule/history indexes and unique job reference index.
- Adds `lead_id` and `job_id` to `growth_review_requests`, expands request status to include `queued`, and adds a tenant/status history index. A follow-up migration adds the `loyalty` touchpoint type.
- Applied to Supabase project `nrsdqrqkffhbicfskilb`; migration history entry verified.

## Verification

- Full `npm run verify:all`: 1,457 PASS lines, 0 FAIL lines.
- Module 13 focused verifier: 29/29 PASS.
- Existing retention journey verifier: 12/12 PASS.
- Existing retention consent policy verifier: 10/10 PASS.
- Contact suppression verifier: 15 PASS / 0 FAIL.
- AI Review verifier updated for worker-queued email delivery: 29/29 PASS.
- TypeScript/TSX syntax check: 239 files, 0 syntax errors.
- Static migration audit: exit 0; no duplicate timestamp prefixes and no SECURITY DEFINER functions missing nearby search_path detected.
- Live Supabase catalog: table exists, RLS enabled, four indexes, authenticated SELECT/INSERT denied, service_role INSERT allowed; review request columns and status constraint confirmed; migration history count 1.

## Known limitations / not certified

- Segmentation is based on CRM activity recency, not a trained or validated churn prediction model.
- Approved retention dispatch currently supports email only. WhatsApp, SMS and voice retain their separate channel-specific communication workflows and are not dispatched from this retention center.
- The 500 customer / 5,000 activity / 200 touchpoint API caps are surfaced in the API response; use database aggregates/pagination for larger tenant datasets.
- Real Resend delivery, provider callbacks, browser E2E and cross-tenant runtime tests were not run.
- `npm run build` could not run because the workspace does not have the `next` executable installed (`next: not found`).
- No production certification claim is made.
