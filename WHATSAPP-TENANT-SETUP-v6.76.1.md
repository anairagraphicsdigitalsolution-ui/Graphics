# Tenant WhatsApp Setup — v6.76.1

1. Generate a 32-byte encryption key: `openssl rand -base64 32`.
2. Add it to Vercel as `GROWTH_TOKEN_ENCRYPTION_KEY` for the target environment. Do not prefix it with `NEXT_PUBLIC_`.
3. Ensure `META_APP_SECRET`, `WHATSAPP_VERIFY_TOKEN`, `NEXT_PUBLIC_SUPABASE_URL`, and `SUPABASE_SERVICE_ROLE_KEY` are configured server-side.
4. Apply `supabase/migrations/20261109270000_growth_whatsapp_tenant_connections_v6761.sql` to the intended Anaira Supabase project.
5. Deploy the app and open AI Growth Engine → Channels & Inbox → WhatsApp Business Connection.
6. Enter the Meta Phone Number ID, optional WABA ID, system-user/permanent access token, and Graph API version.
7. The server verifies the token/phone-number pair with Meta and stores the token encrypted. The browser does not receive the token after saving.
8. Configure the Meta WhatsApp webhook callback to `https://<your-growth-domain>/api/growth/whatsapp/webhook`, subscribe to `messages`, and use the configured `WHATSAPP_VERIFY_TOKEN` for webhook verification.
9. Confirm the Meta app webhook signature uses the same `META_APP_SECRET` configured in Vercel.
10. Test inbound messages and replies using a real WhatsApp test recipient before enabling production automation.

Security notes:
- Do not paste access tokens or encryption keys into chat, source code, or public environment variables.
- The current implementation supports one WhatsApp number per organization.
- Free-form outbound messages are restricted to an open 24-hour customer-service window and active consent. Outside that window use an approved template.
- A STOP/UNSUBSCRIBE keyword records opt-out for the matching tenant lead.
