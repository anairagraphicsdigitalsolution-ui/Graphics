# Central Integrations setup

1. Apply `20261112190000_growth_central_integrations_v6853.sql` in the Anaira Growth Engine Supabase project.
2. Confirm `GROWTH_TOKEN_ENCRYPTION_KEY` is configured on the deployment as a stable 32-byte base64 or 64-character hex value. Back it up securely. Do not rotate it without a credential re-encryption plan.
3. Sign in as a workspace owner or manager and open `/admin/ai-growth/integrations`.
4. Select the active workspace and provider, enter its credentials/settings, then save encrypted credentials.
5. Use **Test connection** where a live provider test is implemented. A provider marked Saved is not live-authenticated.
6. For Facebook/Instagram, Google/YouTube and LinkedIn, configure exact OAuth redirect URLs in provider dashboards and complete the existing OAuth connection flow. The account's granted scopes are stored separately from app credentials.
7. For WhatsApp, enter Access Token, Phone Number ID, WABA ID and Graph API version, then test. A successful test syncs the number into the tenant WhatsApp connection registry for inbound webhook routing and outbound sends.
8. For Cashfree, select Sandbox first. Configure the Cashfree webhook URL as `/api/growth/billing/cashfree-webhook` and use the same webhook secret in the integration vault. Verify sandbox orders before switching to Production.
9. For Resend, use a verified sending domain and a valid `From Email`. Configure inbound webhooks separately if inbound email is required.
10. For Twilio, enter Account SID, Auth Token, From Number and the public HTTPS application URL. ConversationRelay still requires a separately deployed persistent WebSocket service and its own service environment.

Never enter `SUPABASE_SERVICE_ROLE_KEY`, database passwords, `CRON_SECRET`, or other platform-wide secrets in this workspace vault. Those belong in Vercel/server environment variables. Do not send secret values in screenshots or chat messages.
