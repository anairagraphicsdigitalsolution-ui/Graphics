# Email unsubscribe setup — v6.80.3

The email worker now attaches RFC 8058-style one-click unsubscribe headers and a signed unsubscribe URL.

## Environment
- `GROWTH_UNSUBSCRIBE_SECRET`: set a long random secret (at least 32 random bytes, base64/hex text is fine). If omitted, the current Supabase service-role key is used as a signing-key fallback; a dedicated secret is recommended.
- `NEXT_PUBLIC_APP_URL`: canonical HTTPS origin of the deployed application, e.g. `https://growth.example.com`. Do not include a trailing path.

## Behaviour
- Link tokens are HMAC-SHA256 signed and expire after 180 days.
- GET displays a confirmation page; it does not unsubscribe merely because a mail scanner fetched the URL.
- POST supports JSON and form-encoded one-click requests.
- Successful unsubscribe disables `consent_to_contact`, records opt-out time/source, and writes a CRM timeline activity.
- All contact updates are scoped by both lead ID and organization ID.
- Existing email worker consent, bounce and complaint suppression remains in force.

Deploy the app after setting environment variables. Verify using a test contact in a non-production workspace before enabling bulk sending.
