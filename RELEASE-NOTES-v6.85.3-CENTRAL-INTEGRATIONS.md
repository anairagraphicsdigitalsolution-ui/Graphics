# Anaira AI Growth Engine v6.85.3 — Central Integrations Manager

## Added
- New workspace Integrations page at `/admin/ai-growth/integrations`, linked in the main Growth navigation.
- Central credential catalogue: OpenAI, Anthropic, Gemini, Google Cloud/OAuth, Google Custom Search, Meta/Facebook/Instagram, WhatsApp Cloud API, Twilio Voice, Resend, Cashfree, YouTube, LinkedIn, Razorpay and SMTP.
- Workspace owner/manager-only API to save, list masked status, test supported providers and delete credentials.
- AES-256-GCM encrypted credential storage using the existing `GROWTH_TOKEN_ENCRYPTION_KEY`.
- Secret values are never returned to the browser. RLS denies direct browser access; server APIs use explicit workspace role checks.
- Workspace vault resolution wired into OpenAI content generation, Google CSE prospect discovery and scheduled discovery, Twilio outbound calls/TwiML/status signature validation, WhatsApp sender credentials, Resend outbound worker, Cashfree checkout and payment webhook verification.
- Meta OAuth app credentials, LinkedIn OAuth credentials and Google/YouTube OAuth credentials can be read from the workspace vault. Connected social accounts still retain their own encrypted provider tokens and permissions.
- Readiness checks recognize tested workspace integrations where relevant.

## Migration
Apply `supabase/migrations/20261112190000_growth_central_integrations_v6853.sql` after all previous migrations.

## Required environment setting
- `GROWTH_TOKEN_ENCRYPTION_KEY`: 32-byte base64 or 64-character hex key. Keep stable and back it up securely; losing it makes saved credentials undecryptable.
- Existing Supabase server environment variables remain required for database access.
- The persistent ConversationRelay service still requires its own deployment environment (`OPENAI_API_KEY`, `TWILIO_AUTH_TOKEN`, `VOICE_AGENT_WS_URL`, Supabase URL and service role key). This is an infrastructure service, not a browser-stored secret.
- `CRON_SECRET`, Supabase service-role credentials and other platform-wide secrets remain server environment variables by design.

## Provider test coverage
Live authentication tests are implemented for OpenAI, Resend, Twilio, Google Custom Search, Meta app/token, WhatsApp phone-number token, Cashfree, Gemini and Anthropic. YouTube, LinkedIn, Razorpay and SMTP currently receive configuration validation only and require their OAuth or provider-specific verification flow before being treated as live-connected.

## Important boundaries
Saving credentials does not grant provider scopes, create OAuth consent, verify sending domains, approve WhatsApp templates, enable Meta app permissions or guarantee provider account eligibility. OAuth connections, webhooks, public redirect URLs, phone-number registration, sending domains and provider dashboards must still be configured and tested. Some platform-level infrastructure secrets remain in Vercel/server environment variables. Production build, live Supabase migration and provider end-to-end certification have not been run in this source-only environment.
