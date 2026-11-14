# Growth Engine Release Gate — v6.89.8

## New source implementation

- Customer Retention planner for Won CRM customers.
- Internal retention tasks for relationship check-ins, renewals, feedback and review requests.
- Workspace member assignment, lifecycle status updates, CRM timeline logging, contact policy visibility.
- Retention metrics added to the Growth Readiness endpoint.
- Worker deployment profiles validated in source: Hobby-compatible daily Vercel cron, Pro per-minute Vercel profile, GitHub Actions five-minute fallback.

## Live Supabase

- Applied `20261113174852_growth_customer_retention_task_index_v6898` to the connected Anaira Growth Engine project.
- Verified `growth_tasks_retention_due_idx` exists and matches the required partial index definition.
- Reuses existing RLS-protected `growth_tasks` / `growth_lead_activities`; no direct table grants were broadened.

## Verification

- `npm run verify:all`: 661 PASS assertions; exit code 0.
- `npm run verify:syntax`: 173 TS/TSX files; zero syntax errors.
- Customer Retention: 13/13 checks.
- Retention Readiness: 5/5 checks.
- Worker Cadence: 6/6 checks.
- Archive test: passed.

## Not certified

- Next.js production build: not verified. Package installation timed out; this runtime has no installed `node_modules`.
- Actual Resend delivery and proposal response E2E: requires the customer's verified sender domain, keys, deployed URL and successful worker execution.
- Meta/Google/LinkedIn/YouTube OAuth and publishing need real customer assets, scopes and provider-side tests.
- WhatsApp native Calling WebRTC/SDP media integration remains unimplemented; call permission capture is not the same as placing a voice call.
- Google/Outlook calendar invitations are not implemented; ICS export/import is available.
- Two-tenant security penetration testing, production load tests, backup/restore drills and deployment smoke tests remain outstanding.

## Deployment choices

- Vercel Hobby: default `vercel.json` daily cron; delayed automation is not suitable for a time-sensitive SaaS.
- Vercel Pro/Enterprise: use `vercel.pro.json` for per-minute worker cadence.
- GitHub Actions: `.github/workflows/anaira-growth-worker.yml` invokes the worker every five minutes; requires `ANAIRA_GROWTH_SITE_URL` and `ANAIRA_GROWTH_CRON_SECRET` repository secrets, with the latter matching production `CRON_SECRET`.

This release is an incremental source/database delivery, not a 100% production certification.
