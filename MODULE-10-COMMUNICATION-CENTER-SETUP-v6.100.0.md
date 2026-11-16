# Module 10 setup — WhatsApp & Email Center (v6.100.0)

## 1. Select the workspace

Open **Admin → AI Growth → Communication Center**. The active workspace is taken from the shared AI Growth workspace selector.

## 2. Configure Twilio for SMS

Open **Integrations → Twilio Voice / SMS** and save:

- Account SID
- Auth Token
- From Phone Number in E.164 format (for example `+1...` or `+91...`)

Set `NEXT_PUBLIC_APP_URL` (or `NEXT_PUBLIC_SITE_URL`) to the public HTTPS app origin. The outbound SMS worker attaches this status callback URL:

`https://YOUR-APP-ORIGIN/api/growth/sms/webhook`

Configure the same endpoint as the inbound Messaging webhook for the Twilio number. Twilio signs webhook requests with `X-Twilio-Signature`; the route verifies the signature before accepting events.

Run **Test connection** in the integration vault. The test verifies Twilio account API authentication; the sender number must also be configured in settings.

## 3. Record SMS consent

In CRM, record explicit SMS channel consent with its source and method. Global opt-out, SMS channel suppression, workspace channel disablement and quiet hours block sends. A contact must have a valid E.164 phone number.

The Communication Center SMS composer queues a job. The worker rechecks consent immediately before calling Twilio. Provider acceptance is not final delivery; status callbacks update the message lifecycle.

Inbound `STOP`, `STOPALL`, `UNSUBSCRIBE`, `CANCEL`, `END` and `QUIT` messages revoke SMS consent for a matching CRM contact and create an activity record.

## 4. Email / Resend

Configure the workspace Resend API key and verified sender email in Integrations. The existing inbound email lifecycle uses:

`https://YOUR-APP-ORIGIN/api/growth/email/webhook`

Configure the Resend webhook signing secret as `RESEND_WEBHOOK_SECRET` in the deployment environment. Subscribe to the provider events used by the app: `email.received`, `email.delivered`, `email.delivery_delayed`, `email.bounced` and `email.complained`.

Use Email Templates to save reusable drafts. Saving a template does not send it. Email delivery events appear separately in the Communication Center.

## 5. WhatsApp

Connect the workspace WhatsApp Business Cloud account in Channels / Integrations. Submit templates in Meta WhatsApp Manager first, then register the exact approved template and confirmation in Anaira's WhatsApp Template Manager. Free-form replies remain restricted to the 24-hour customer service window.

## 6. Worker

The existing Growth worker must run with `CRON_SECRET`, `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`. It claims queued jobs and dispatches SMS after tenant status, consent, suppression, quota and communication policy checks.

## 7. Production checklist

- [ ] Twilio integration saved and API connection test passed
- [ ] E.164 sender number verified for the Twilio account
- [ ] Public app URL configured
- [ ] Inbound and status callback webhooks configured
- [ ] Test contact has explicit SMS consent
- [ ] Test inbound STOP and verify CRM SMS consent is revoked
- [ ] Verify queued → provider accepted → delivered/failed lifecycle
- [ ] Resend domain and webhook signature verified
- [ ] WhatsApp number connected and templates provider-approved
- [ ] Browser E2E and tenant-isolation tests completed

Do not use production customer contacts for initial provider tests without appropriate consent.
