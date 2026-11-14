# Anaira AI Growth Engine v6.89.5 — Proposal Delivery & CRM Readiness

## Implemented in this release
- Approved CRM proposals can be queued through the workspace's configured Resend email provider.
- Send endpoint restricts access to workspace owners/managers and checks CRM entitlement.
- Database RPC repeats the actor-role, active-tenant, approved-proposal, explicit email-consent, opt-out, bounce and complaint checks.
- RPC locks the proposal row and returns the existing queued job for repeat requests, avoiding duplicate pending sends.
- Worker marks the proposal Sent only after Resend accepts the send request; terminal delivery failures become retryable `failed` status.
- Proposal send/retry state is exposed on the CRM lead profile.
- CRM meeting cards export UTC `.ics` files for import into Google Calendar, Outlook or Apple Calendar. This does not send calendar invitations.
- Readiness API reports meeting/proposal counts and delivery readiness; email readiness now requires unsubscribe URL base configuration as well as provider credentials.
- Strict null-safe authorization guard is applied to the proposal queue RPC.

## Database
- `growth_proposal_email_delivery_v6895` — delivery tracking columns and service-role-only queue RPC.
- `growth_proposal_delivery_role_null_guard_v6895a` — null-safe actor authorization hardening.
- Applied to the connected Anaira Growth Engine Supabase project; columns, function definition and privileges were checked after migration.

## Verification
- `npm run verify:all`: exit code 0.
- 619 PASS assertions across the complete regression suite.
- TypeScript/TSX syntax scan: 168 source files, zero syntax errors.
- New proposal delivery checks: 14/14 passed.
- Existing CRM sales execution checks: 14/14 passed.
- ZIP integrity checked after packaging.

## Explicit limits
- Proposal sends require active lead email consent, a verified Resend sender/domain, configured integration credentials, public app URL for unsubscribe links and a deployed worker.
- Provider acceptance is recorded as Sent; it does not prove inbox delivery or reading.
- Calendar support is `.ics` export, not Google/Outlook OAuth invitation delivery.
- `npm install` timed out in this environment. Therefore `next build` and production deployment are not certified here.
- WhatsApp-native Calling media/signalling, live third-party provider certification, multi-tenant penetration testing, backup/restore drills and deployment/worker certification remain open gates.
