# v6.86.0 Integration Deployment Checklist

## Database
Apply, in order:
1. `20261112190000_growth_central_integrations_v6853.sql` (if not already applied)
2. `20261112193000_growth_central_integrations_v6860.sql`

The second migration adds integration event history and token-expiry metadata. It enables RLS and denies direct client access to integration events.

## Runtime
- Set `GROWTH_TOKEN_ENCRYPTION_KEY` to a stable 32-byte base64 or 64-character hex key.
- Keep `SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET`, Meta webhook signing secrets and other platform-wide secrets in Vercel server environment variables.
- Run `npm install` after deploying this source to install `nodemailer` for authenticated SMTP verification.
- Do not rotate the encryption key without a controlled re-encryption migration; otherwise existing credentials cannot be decrypted.

## Provider setup and tests
- Open `/admin/ai-growth/integrations`.
- Choose the correct workspace, enter credentials, save, then run Test connection.
- A Connected result means the provider's implemented API/auth check succeeded. It does not mean an outbound call, message, email, or payment was completed.
- SMTP test performs connection/TLS/auth verification only; it does not send an email.
- Cashfree and Razorpay tests authenticate/read the payment API only; they do not create or settle a payment.
- Twilio test verifies Account API authentication only; it does not place a call.
- WhatsApp test verifies phone-number metadata access only; it does not send a message.
- Google OAuth and LinkedIn app credentials without a user refresh/access token remain Validation only until OAuth consent has completed.
- YouTube test requires a valid refresh token or API key plus Channel ID.

## OAuth
- YouTube and LinkedIn callback paths synchronize returned tokens into encrypted central vault and social account storage.
- Refresh helper is server-only and refreshes an expiring social token when a caller requests it.
- Google generic OAuth connect/callback UI is not yet included; do not mark Google OAuth as connected merely because Client ID and Secret are saved.

## Final E2E acceptance
Run separately in a controlled test workspace:
- WhatsApp: approved test recipient, outbound text/template, inbound webhook, conversation persistence.
- Voice: consented E.164 test number, Twilio call, TwiML/ConversationRelay, status callback.
- Email: verified sender, controlled inbox, send and inbound reply handling.
- Payments: sandbox order, provider checkout, signed webhook, settlement reconciliation, duplicate webhook idempotency.
Record provider request IDs and webhook event IDs. Never use production customer contacts or live charges for tests without explicit approval.
