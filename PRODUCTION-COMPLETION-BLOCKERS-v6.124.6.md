# Production Completion Gates — v6.124.6

This checklist separates source implementation from live provider certification. Do not mark a row complete based only on a UI page or API route.

| Gate | Current status | Required completion evidence |
|---|---|---|
| Source regression suite | PASS | `VERIFY-ALL-v6.124.6.log`: 1,825 PASS / 0 FAIL |
| TypeScript/TSX syntax | PASS | 249 files / 0 syntax errors |
| Production Next.js build | PASS on deployed Git commit | Vercel build event: Build Completed; exact updated ZIP not deployed |
| Supabase migration history | PASS | Nine 2026-11-17 migrations recorded |
| RLS coverage | PASS | 98/98 public tables RLS-enabled |
| FK indexing | PASS | 58 indexes added; advisor warning count 0 |
| RLS policy overlap | PASS | Four overlapping-policy warnings eliminated without broadening SELECT access |
| Supabase health | PASS | No health lints |
| Leaked-password protection | BLOCKED: dashboard setting | Enable in Supabase Auth security/password settings |
| OpenAI briefing | BLOCKED: provider credits | Fund OpenAI API organization or configure funded BYOK key; verify briefing request succeeds |
| Social publishing | NOT CERTIFIED | Connect intended Meta/Instagram/LinkedIn/YouTube accounts and run approved test posts, then verify provider IDs and webhook outcomes |
| Worker cadence | NOT CERTIFIED | Grant GitHub access to Vercel-linked repository; configure `ANAIRA_GROWTH_SITE_URL` and `ANAIRA_GROWTH_CRON_SECRET`; verify scheduled runs and retries |
| Tenant adversarial E2E | NOT RUN | Two test tenants; prove cross-tenant API/RLS/storage denial |
| WhatsApp native Calling | NOT CERTIFIED | Meta Calling eligibility, WebRTC/SIP media, SDP and call lifecycle tested with approved provider account |
| Billing/finance E2E | NOT RUN | Gateway sandbox webhook signatures, duplicate webhook, refund and ledger reconciliation |
| Backup/restore | NOT RUN | Restore drill and data integrity report |
| Exact updated source deployment | BLOCKED: GitHub repo access | Connect GitHub identity with access to `anairagraphicsdigitalsolution-ui/Graphics`, then commit/push this package and verify new deployment |

## Required external values / accounts

Never paste secrets into chat. Add them only in the appropriate provider dashboard or Vercel/GitHub secret store.

- OpenAI: funded API key / organization billing.
- GitHub Actions: `ANAIRA_GROWTH_SITE_URL`, `ANAIRA_GROWTH_CRON_SECRET`.
- Meta/Instagram: app permissions, OAuth app, webhook subscription, business account and connected social account.
- Email: verified sender domain, Resend API key, webhook signing secret.
- Supabase Auth: leaked-password protection enabled.

## Release rule

The release is production-certified only after every applicable row has a dated test result, sanitized provider request/response identifier, deployment ID and responsible tester sign-off. Never enable autonomous outbound messages, ads spend, billing actions or voice calls merely to make a checklist green.
