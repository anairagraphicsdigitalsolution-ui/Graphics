# v6.85.1 deployment notes

1. Deploy the Next.js application from this source package.
2. Apply all prior migrations, including `20261112120000_growth_autonomous_execution_foundations_v6849.sql` and `20261112150000_growth_phase31_autonomous_engines_v6850.sql`.
3. Configure existing Google CSE, Supabase, Twilio and Meta environment variables as documented in `PHASE31-DEPLOYMENT-v6.85.0.md`.
4. Deploy `services/voice-agent` as a persistent Node.js WebSocket service with `OPENAI_API_KEY`, `OPENAI_MODEL`, `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and `PORT`; set `VOICE_AGENT_WS_URL` on the app to its public `wss://` URL.
5. Confirm the Twilio number/account supports ConversationRelay, then test only with a consented test lead. Confirm verbal opt-out updates `growth_leads.contact_opted_out_at` and `consent_to_contact=false`.
6. Connect a Meta account with `ads_read` for analysis and `ads_management` for owner-approved changes. Verify the current/prior period and placement breakdown responses before proposing any change.
7. Run `npm run verify:all`, then a production build in an environment with dependencies installed.

The release is source-hardened, not production-certified. Scheduled prospect discovery, recurring campaign optimization and several advanced analysis/verification features remain outstanding as stated in the release notes.
