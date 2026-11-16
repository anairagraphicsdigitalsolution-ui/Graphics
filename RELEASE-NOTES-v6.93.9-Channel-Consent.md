# Anaira AI Growth Engine v6.93.9 — Channel-Specific Consent Enforcement

## Changes
- Added `channel_consents` JSONB evidence to leads for email, WhatsApp, SMS and voice.
- Added a service-role-only database RPC that validates channel names, requires source/method evidence for grants, verifies workspace owner/manager (or platform admin), and updates the selected channel atomically.
- Added a CRM panel for managers to record/revoke channel consent with an evidence source.
- Generic contact consent no longer authorizes an outbound channel on its own.
- Worker WhatsApp text/template sends require WhatsApp-specific consent.
- Worker email sends require email-specific consent plus existing bounce/complaint/global opt-out checks.
- Direct WhatsApp, template, Twilio voice and human inbox email/WhatsApp reply paths now check their channel-specific consent.
- Email one-click unsubscribe revokes email consent only; it no longer automatically opts the customer out of every other channel.
- Global opt-out clears all channel consents. Re-consenting globally does not silently grant channel permissions.
- Retention eligibility now reports channel-specific consent state.
- Updated regression verifiers and migration audit output for the new release.

## Verification
- `npm run verify:syntax`: PASS, 199 TS/TSX files, 0 syntax errors.
- `npm run verify:all`: PASS, 1,028 PASS lines, 0 FAIL lines.
- Channel-consent verifier: 16/16 PASS.
- Migration audit: 76 ordered migration files; static checks only.
- No remote database migration was applied. The new consent schema must be deployed before enabling channel consent in a live workspace.
- Live provider tests and production build remain external release gates.
