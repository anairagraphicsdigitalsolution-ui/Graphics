# Anaira AI Growth Engine v6.86.4 — Website DNS Verification

## Delivered
- Added owner/manager-only website verification API.
- Generates a one-time random challenge and stores only its SHA-256 hash.
- Uses DNS TXT ownership proof at `_anaira-growth.<domain>`.
- Verifies the exact TXT value before changing `verification_status` to `verified`.
- Records verification check and successful verification timestamps.
- Added Generate DNS record and Verify now actions to Managed websites.
- Added migration `20261112195000_growth_website_dns_verification_v6864.sql`.

## Required deployment step
Apply the migration in `supabase/migrations/20261112195000_growth_website_dns_verification_v6864.sql` to the connected Supabase project before using the new buttons. Deploy the updated Next.js source after applying it.

## DNS instructions
For each website, click **Generate DNS record** and add the displayed TXT record exactly:
- Type: TXT
- Name: `_anaira-growth.<domain>`
- Value: `anaira-growth-verification=<one-time-token>`

Wait for DNS propagation, then click **Verify now**. A successful exact match marks the website `verified`. The challenge is one-time; generate a new record if the token is lost or replaced.

## Security
- Verification endpoints require an authenticated session and workspace owner/manager permission.
- Website lookup is scoped to the active organization.
- Plaintext verification tokens are returned only once to the authorized user and are not persisted; only SHA-256 hashes are stored.
- DNS TXT verification proves control of the domain's DNS zone; it does not audit the website's uptime, content, or ownership/legal identity.

## Checks
- `node scripts/verify-growth-website-verification.cjs` — 8/8 passed.
- Full Next.js production build not run: dependency installation timed out in the current environment.
