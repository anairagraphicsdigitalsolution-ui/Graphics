# Anaira AI Growth Engine v6.124.7 — Customer Retention Multi-channel Dispatch

## Completed source work
- Customer Retention touchpoints now support email, approved WhatsApp templates, and SMS.
- Customer rows expose channel-specific eligibility and block reasons using the existing consent/suppression policy.
- WhatsApp retention drafts require a tenant-owned template already marked approved in Anaira after confirmation in WhatsApp Manager. Template variables are resolved from the customer record at queue time.
- SMS retention drafts require an E.164 phone number and explicit SMS channel consent.
- All three channels retain mandatory human approval, scheduled queueing, idempotency, cancellation controls, tenant scoping, and worker-side policy rechecks. Existing queued/succeeded jobs are reconciled without duplicate dispatch; uncertain provider outcomes block automatic retry.
- Worker success/failure lifecycle now updates the matching retention touchpoint for email, WhatsApp template, and SMS jobs.
- Added migration `20261117060000_growth_retention_multichannel_v61310.sql` to expand the channel constraint, persist the selected WhatsApp template, and add a channel/status scheduling index.

## Credentials intentionally not included
- Resend sender/API credentials, Meta WhatsApp connection/template approval, and Twilio SMS credentials remain workspace configuration. No credentials were added to source.
- Provider delivery has not been attempted by this source-only update.

## Verification
- Focused retention verifier: 32/32 PASS.
- Full TS/TSX syntax scan: 249 files, 0 syntax errors.
- Worker regression verifier: PASS.
- Send-policy verifier: 19/19 PASS.
- Full `npm run verify:all` was started; this environment timed out after 1,766 PASS assertions and 0 FAIL assertions. It did not reach the end of the suite.
- Dependency-backed ESLint, TypeScript project check, Next.js production build and live provider delivery remain unverified.

## TypeScript build correction — SMS idempotency race recovery

- Fixed the SMS insert/recovery query shape in `app/api/growth/retention/outreach/route.ts`.
- Existing, newly inserted, and unique-conflict-recovered SMS rows now consistently select `id,status`.
- This resolves the TypeScript mismatch where the race-recovery branch returned `{ id }` while the shared SMS record variable requires `{ id, status }`.
- Added `verify:growth-retention-sms-race-type` and registered it in `verify:all` to prevent this regression.
- Verification: 4/4 focused assertions pass; 249 TS/TSX files pass the syntax scan. Full Next.js typecheck/build still requires installing project dependencies in the target environment.
