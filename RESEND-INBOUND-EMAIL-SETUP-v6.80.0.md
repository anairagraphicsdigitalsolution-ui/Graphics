# Resend inbound email setup — v6.80.0

1. In Resend, verify the receiving domain and enable inbound email routing for the addresses you want to receive.
2. Create a Resend webhook pointing to `https://YOUR_DOMAIN/api/growth/email/webhook`.
3. Subscribe to: `email.received`, `email.delivered`, `email.delivery_delayed`, `email.bounced`, and `email.complained`.
4. Copy the webhook signing secret (`whsec_...`) into Vercel as `RESEND_WEBHOOK_SECRET`.
5. Ensure `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are set server-side.
6. Deploy the v6.80.0 source.
7. As the workspace owner, call `POST /api/growth/email/inbound-addresses` with a bearer session token and JSON:
   `{"organizationId":"<workspace UUID>","emailAddress":"support@your-verified-domain.com"}`
8. Test with a real inbound message. It should appear in the unified inbox as an email conversation marked for human handoff.
9. Send a test email to a controlled address and verify bounce/complaint events suppress future sends.

The receiving address must be routed by Resend to the webhook. Adding it in the Growth Engine alone does not create DNS or mail routing.
