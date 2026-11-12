# Anaira AI Growth Engine v6.85.1 — Phase 31.1 Hardening

## Source changes in this patch

### Prospect intelligence
- Replaced homepage-only extraction with a bounded same-domain crawl of up to four HTTPS pages.
- Contact/about/company/team pages are followed only on the original host; redirects are not followed.
- DNS public-IP validation, 10-second total timeout, bounded page count and bounded per-page body size remain in place.
- Captures the number of pages crawled in prospect notes and uses it only as a small transparent quality-score input.
- Public contact details remain unverified until human review. `consent_to_contact` remains false.

### Conversational voice
- Serialized incoming ConversationRelay messages to avoid overlapping AI turns.
- Caller language is mirrored; responses remain concise and constrained to the approved business prompt.
- Verbal opt-out phrases (including do-not-call / stop-calling requests) immediately end the conversation and persist the lead opt-out in CRM.
- Call finalization persists transcript plus an AI-generated structured summary (outcome, intent, objections, next step) into `call_summary`.
- Human handoff language is acknowledged without pretending a transfer occurred.
- Outbound API response now correctly distinguishes configured ConversationRelay from scripted TTS fallback.

### Campaign intelligence
- Replaced the single rolling `last_30d` snapshot with explicit current 30-day and preceding 30-day date windows.
- Aggregates metrics across returned insight rows, calculates CPA trend and spend/conversion changes, and includes publisher-platform / placement breakdowns.
- Accepts an optional `targetCPA` query input for advisory comparison only.
- No campaign mutation is made by the insights endpoint. Budget/status changes remain owner/manager approval-gated with stale-state checks, caps and rollback.

## Verification
- `node scripts/verify-syntax.cjs`: PASS (147 TS/TSX files, zero syntax errors).
- `node --check services/voice-agent/server.mjs`: PASS.
- `npm run verify:all`: PASS, including Phase 31 checks (12/12).
- Full Next.js production build not run: source ZIP has no `node_modules` and no package lockfile.

## Still not production complete
- Per-workspace scheduled/recurring prospect discovery and worker execution are not implemented.
- Independent email/phone verification (OTP, carrier lookup or external verification provider) is not implemented; extracted contacts remain human-review data.
- Advanced ICP/AI lead scoring and assignment rules are not implemented; current score remains heuristic.
- Twilio ConversationRelay must be deployed as a persistent WebSocket service and tested with a real consented call. This source patch cannot certify Twilio account eligibility, media behavior, interruptions or call quality.
- Voice call outcome summaries are persisted on relay finalization; real provider callback + CRM workflow E2E certification is still required.
- Campaign analysis now includes period comparison and placement breakdowns, but recurring scheduled optimization, target-CPA learning, creative-level analysis, audience-level analysis and before/after experiment measurement are not complete.
- Meta execution remains approval-driven. Only supported daily budget and pause/resume actions are implemented; bid, audience, creative and targeting write operations are not implemented.
- Supabase migrations and Google CSE, Twilio/OpenAI and Meta provider actions were not run against live credentials. Do not certify production completion until live migration, tenant isolation, webhook, call, campaign apply/rollback and deployment tests pass.

## Database
No additional migration is introduced by v6.85.1. The Phase 31 migration remains required:
`supabase/migrations/20261112150000_growth_phase31_autonomous_engines_v6850.sql`
