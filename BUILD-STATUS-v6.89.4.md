# Build status — v6.89.4

- Source-level TypeScript/TSX syntax validation: passed (167 files, 0 syntax diagnostics).
- Full configured regression suite `npm run verify:all`: passed (exit code 0).
- Dedicated CRM sales-execution checks: 14/14 passed.
- Connected Supabase migration `growth_meetings_proposals_v6894`: applied and verified.
- RLS: enabled on `growth_meetings` and `growth_proposals`.
- Direct `anon` and `authenticated` SELECT table privileges: false; `service_role` SELECT: true.
- `npm install --ignore-scripts --no-audit --no-fund --prefer-offline` timed out in this environment. Consequently `next build` has not been run and is not claimed as passed.
- Live calendar invitations, customer proposal delivery, WhatsApp/email/voice sends, live provider OAuth permissions and two-tenant penetration tests remain external certification items.
