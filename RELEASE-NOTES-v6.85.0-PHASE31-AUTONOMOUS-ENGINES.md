# v6.85.0 — Phase 31 Autonomous Growth Engines

## Implemented in source

### Prospect Intelligence
- Bounded Google Custom Search discovery retained.
- Public business homepage enrichment (7-second timeout, 1 MB response cap, no redirect following).
- Publicly displayed business email/phone extraction, website verification flag, enrichment state and heuristic quality score.
- Tenant-scoped discovery run history with discovered/saved/duplicate/skipped counters.
- Outreach consent remains false by default; contact extraction is not consent to contact.

### Conversational Voice Foundation
- Twilio outbound calls now use a signed-TwiML webhook endpoint.
- Added signature-validated Twilio status callback and call lifecycle persistence.
- Added a standalone persistent WebSocket ConversationRelay service under `services/voice-agent` using OpenAI for turn-by-turn conversational responses.
- TwiML automatically selects ConversationRelay when `VOICE_AGENT_WS_URL` is configured; scripted TTS remains as an explicit fallback.
- Call transcripts are persisted when the relay stops/closes. Call recording is not automatically enabled; legal recording consent and provider configuration are required.

### Campaign Optimization Governance
- Added tenant-scoped optimization proposal history.
- Added proposal, reject, approve/apply and rollback API actions.
- Live campaign state is re-read before applying; stale proposals are rejected.
- Budget changes are capped by environment-configured maximum percentage and absolute daily budget.
- Meta `ads_management` is required for changes; owner/manager approval is mandatory.
- Applied actions are audited and can be rolled back to captured before-state.

### Readiness
- Readiness now separates outbound Twilio, conversational AI voice, Meta insight analysis and campaign execution requirements.
- Does not claim a feature is production-ready merely because provider credentials exist.

## Database
Apply `supabase/migrations/20261112150000_growth_phase31_autonomous_engines_v6850.sql` after all prior migrations.

## Verification
- `verify:syntax`: 147 TS/TSX files, 0 syntax errors.
- `verify:growth-phase31`: 8/8 source-contract checks passed.
- `verify:all`: passed across existing and Phase 31 suites.
- Production Next.js build was not run: dependency installation timed out and the ZIP does not contain `node_modules` or a lockfile.
- Live Supabase migration, Google CSE, Twilio ConversationRelay and Meta write operations were not run. Provider certification remains pending.

## Known production dependencies / limitations
- Prospect discovery is Google-index-based plus a bounded homepage fetch, not a full crawler or independently verified lead database. Email/phone are marked for human review; consent stays false.
- The conversational voice agent requires deployment of `services/voice-agent` as a persistent WebSocket service. Standard Next.js serverless functions cannot host the long-lived WebSocket.
- Campaign optimization is approval-driven, not unconstrained self-modifying. Only daily budget and pause/resume proposals are supported here; targeting/bid/creative changes remain recommendations until implemented and provider-certified.
- OpenAI/Twilio/Meta provider credentials, scopes, account eligibility, public webhook URLs and real calls/campaign tests are required before production certification.

## Explicitly not yet complete
- Scheduled/recurring prospect discovery with per-workspace schedule controls and worker execution is not implemented in this release.
- Prospect enrichment is homepage-only; there is no multi-page crawl, independent phone/email verification service, or AI-assisted ICP scoring beyond the transparent heuristic score.
- ConversationRelay is a real two-way conversational foundation, but production conversation quality, interruption behavior, language handling, opt-out detection, transcript summaries and call outcome-to-CRM automation need live end-to-end tests and further hardening.
- Campaign analysis is based on provider insights and current recommendations; scheduled autonomous optimization loops, creative/audience breakdown intelligence, target CPA learning and before/after experiment reporting are not yet complete. Live write actions are proposal-driven and owner-approved.
