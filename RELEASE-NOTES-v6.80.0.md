# Anaira AI Growth Engine v6.80.0

## AI Employee — inbound email and delivery suppression

- Added a Resend/Svix signed inbound webhook endpoint at `/api/growth/email/webhook`.
- Enforces webhook signature, timestamp freshness and provider event idempotency.
- Routes inbound mail through owner-configured tenant inbox addresses.
- Creates or appends tenant-scoped email conversations and marks them for human handoff.
- Records delivered, delayed, bounced and complained provider events.
- Adds lead delivery-state timestamps and blocks manual/worker email sends to bounced or complained addresses.
- Added owner-only inbound address management API at `/api/growth/email/inbound-addresses`.
- Added ten focused regression checks.

## Setup required
- Configure `RESEND_WEBHOOK_SECRET` in Vercel.
- Register `https://<your-domain>/api/growth/email/webhook` as a Resend webhook for `email.received`, `email.delivered`, `email.delivery_delayed`, `email.bounced`, and `email.complained`.
- Verify your receiving domain and configure inbound routing in Resend.
- Add each tenant's receiving address through the owner-only inbound-address API.

This does not automatically enable inbound email until the Resend domain, webhook, and tenant address mapping are configured.
