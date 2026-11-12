# Anaira AI Growth Engine — Phase 31.1 deployment (v6.85.2)

## Database migrations
Apply in order after the v6.85.0 Phase 31 migration:
1. `supabase/migrations/20261112170000_growth_autonomous_schedules_v6851.sql`

The migration creates tenant-scoped recurring schedules, execution history, RLS policies, and an atomic `SKIP LOCKED` worker claim function.

## Recurring schedules
Use the workspace UI at `/admin/ai-growth/automation/schedules` or `/api/growth/autonomous-schedules` (owner/manager only):
- `POST` schedule type `prospect_discovery` with `config.industry`, `config.location`, optional `config.keywords`.
- `POST` schedule type `campaign_analysis` with `config.socialAccountId`, optional `config.targetCPA`. The connected Meta account must have `ads_read`.
- `intervalHours` is 24–720 hours.
- `PATCH` supports pause/resume, interval/name/config updates, and `runNow`.
- `GET` returns schedules and the latest 50 execution records. `DELETE` removes a schedule.

The existing authenticated worker (`/api/growth/worker`) processes due schedules. Vercel Hobby's current daily cron runs them once daily; a schedule interval is a minimum cadence, not an exact-time guarantee. Configure the worker cron according to the hosting plan and keep `CRON_SECRET` private.

Scheduled prospect discovery runs Google Custom Search, bounded public same-domain crawling, extraction and heuristic scoring. Extracted email/phone values remain unverified and `consent_to_contact` remains false. No outreach is sent.

Scheduled campaign analysis compares the latest 30 days with the preceding 30 days and stores metrics/recommendations. It does not make campaign changes; spend-changing actions remain owner/manager approved through the existing proposal API.

## Voice agent security and deployment
Deploy `services/voice-agent` as a persistent Node.js WebSocket service. Configure on that service:
- `OPENAI_API_KEY`
- `OPENAI_MODEL` (default `gpt-4o-mini`)
- `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY` (server only)
- `TWILIO_AUTH_TOKEN`
- `VOICE_AGENT_WS_URL` — the exact public `wss://` URL used in TwiML, including path, e.g. `wss://voice-agent.example.com/twilio/voice`
- `PORT` (default 8080)

The WebSocket handshake validates `X-Twilio-Signature`, checks the configured path, and binds the setup message to the stored call attempt, workspace, lead and CallSid. Configure the same exact `VOICE_AGENT_WS_URL` on the Next.js app.

Call recording is not enabled by default. Enable only after configuring legally appropriate recording notice/consent and a provider recording policy.

## Remaining production certification
Source checks do not prove live operation. Still required: apply the migration to the target Supabase project; deploy the Next.js app and persistent WebSocket service; configure valid Twilio, OpenAI, Google CSE and Meta credentials/scopes; test signed callbacks and real consented calls; test Meta read/write permissions, approvals, rollback and before/after metrics; run a production Next.js build and tenant-isolation tests.
