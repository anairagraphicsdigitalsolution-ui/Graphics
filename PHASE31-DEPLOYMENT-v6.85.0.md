# Anaira AI Growth Engine — Phase 31 deployment (v6.85.0)

This release adds real application code and schema for prospect enrichment, Twilio call callbacks/ConversationRelay, and approval-governed Meta campaign optimization. It is not a claim of live provider certification.

## Apply database migration

Apply `supabase/migrations/20261112150000_growth_phase31_autonomous_engines_v6850.sql` after the v6.84.9 migration. It adds prospect quality/enrichment fields, discovery run history, voice transcript/recording lifecycle fields, and RLS-protected campaign optimization action history.

## Environment variables

Existing:
- `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY` (server only)
- `GOOGLE_CSE_API_KEY`
- `GOOGLE_CSE_CX`
- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`
- `TWILIO_VOICE_FROM`
- `APP_BASE_URL` (must be the public HTTPS application origin)
- `META_GRAPH_API_VERSION`

For conversational voice:
- `VOICE_AGENT_WS_URL` — public `wss://` endpoint to the standalone ConversationRelay service, e.g. `wss://voice-agent.example.com/twilio/voice`
- On the voice-agent service: `OPENAI_API_KEY`, `OPENAI_MODEL` (default `gpt-4o-mini`), `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and `PORT` (default 8080).
- Deploy `services/voice-agent` as a persistent Node WebSocket service. It cannot run as a normal Next.js serverless route because Twilio ConversationRelay requires a long-lived WebSocket connection.

For campaign optimization safety:
- `MAX_AUTOMATED_BUDGET_CHANGE_PERCENT` (default 20)
- `MAX_META_DAILY_BUDGET_MINOR` (default 100000000; currency minor units)
- Connected Meta account must include `ads_read` for insights and `ads_management` for approved actions.

## Feature behavior and safety

### Prospect discovery
- Searches Google Custom Search and attempts a bounded (7-second, 1 MB) public homepage fetch without following redirects.
- Extracts only publicly displayed business contact details from the homepage; these are unverified until human review.
- Records discovery runs, enrichment state, and a heuristic quality score.
- `consent_to_contact` remains false. Discovery does not authorize calling, email, or WhatsApp outreach.
- This is not a full-site crawler and does not discover private/personal contact information.

### Voice calling
- The authenticated route checks tenant role, explicit lead consent, opt-out status, E.164 phone format, and configured Twilio credentials.
- Twilio callbacks are signature-validated and update call status, duration, recording metadata, and audit history.
- If `VOICE_AGENT_WS_URL` is configured, TwiML uses Twilio ConversationRelay and the standalone WebSocket service uses OpenAI to respond to caller speech. Otherwise the route uses the existing one-way script playback fallback.
- Configure Twilio's account/number to permit ConversationRelay and test in a consented test workspace before production.
- Call recording is not automatically enabled. Configure lawful recording consent and provider recording policy before enabling it.

### Campaign optimization
- Recommendations remain separate from execution.
- Proposals capture the before/after state; only workspace owners/managers can approve or reject.
- Applying a proposal checks that live state still matches the captured before-state and enforces a maximum budget delta/cap.
- Rollback restores the recorded before-state and writes an audit event.
- The API never increases budgets beyond the configured ceiling. Meta account permissions and campaign-level budget support are required.

## Verification

Run:
- `npm run verify:syntax`
- `npm run verify:growth-phase31`
- `npm run verify:all`

A passing source verification does not replace a production build, Supabase migration execution, provider webhook tests, or real Meta/Twilio end-to-end certification. Do not mark the system production-complete until those checks pass.
