# Independent source audit — v6.90.3

## Changes from v6.90.2
Native WhatsApp Business Calling outbound signaling and browser WebRTC media initiation have been added. This is separate from the existing Twilio ConversationRelay voice agent and from the WhatsApp call-permission request workflow.

## Additional correction
The call-permission request endpoint previously passed the WhatsApp phone-number ID as the tenant identifier to the credential resolver. It now supplies the actual organization ID and selected phone-number ID, preventing tenant credential resolution from silently failing or selecting the wrong scope.

## Implemented in source
- Consent and opt-out checks are performed again at call initiation.
- A current, lead-matched customer call-permission record is required.
- Tenant owner/manager and WhatsApp feature entitlement are enforced.
- Meta Graph API outbound `connect` and `terminate` actions are wired.
- Browser captures microphone audio, creates a real SDP offer, applies Meta's SDP answer, and plays remote audio. The call-permission endpoint resolves credentials against the correct organization.
- Call sessions are tenant-scoped, RLS-protected, auditable and protected against multiple concurrent calls per lead.
- Meta call lifecycle webhooks update outbound session state.

## Verification run
- `npm run verify:all`: PASS, exit code 0.
- 722 explicit PASS assertions, 0 explicit FAIL assertions.
- Native WhatsApp calling checks: 18/18.
- TypeScript/TSX syntax scan: 177 files, 0 syntax errors.
- Next.js production build remains blocked because the Next CLI/dependency installation is unavailable in this environment.

## Still not production-certified
- Inbound WhatsApp calls and inbound answer/reject user flows.
- Production TURN infrastructure and media quality across restrictive networks.
- Meta app review, WhatsApp Calling eligibility/settings, live provider credentials and actual call tests.
- Clean dependency install/lockfile and production build.
- Two-tenant penetration tests, load/concurrency tests, worker failure drills, backup/restore and deployed SHA verification.

No Growth Engine migrations were applied to the connected Anaira CRM database. The new migration must be applied only to the dedicated Growth Engine Supabase project.
