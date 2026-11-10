# Anaira AI Growth Engine — Worker Scheduler Setup

The worker endpoint is `GET /api/growth/worker` and requires `Authorization: Bearer <CRON_SECRET>`. It claims queued delivery jobs and due workflow runs from Supabase using database claim RPCs.

## Choose one scheduler

### Option A — Vercel Hobby (recommended default)
Hobby cron supports daily schedules only. The default `vercel.json` is intentionally daily at 03:00 UTC (08:30 IST); this is suitable for daily maintenance, NOT minute-sensitive follow-ups.

For real follow-up timing on Hobby, enable the GitHub Actions fallback:
1. Push this repository to GitHub and ensure Actions are enabled.
2. In repository Settings → Secrets and variables → Actions, add:
   - `ANAIRA_GROWTH_SITE_URL` = `https://graphics.anairapos.in` (no trailing slash)
   - `ANAIRA_GROWTH_CRON_SECRET` = exactly the same strong value as Vercel `CRON_SECRET`
3. Ensure Vercel Production has `CRON_SECRET`, `NEXT_PUBLIC_SUPABASE_URL`, and `SUPABASE_SERVICE_ROLE_KEY`.
4. In `.github/workflows/anaira-growth-worker.yml`, scheduled runs invoke the worker every five minutes; `workflow_dispatch` permits a manual test.
5. To avoid an extra daily invocation, you may remove the `crons` entry from `vercel.json` after confirming GitHub Actions is running successfully.

GitHub scheduled workflows are best-effort and can be delayed. Five-minute cadence is not a hard real-time SLA.

### Option B — Vercel Pro / Enterprise
Copy `vercel.pro.json` over `vercel.json` (or merge its `crons` entry) before deployment. This config invokes the worker every minute. Vercel cron schedules are UTC.

### Do not run both schedulers unnecessarily
Use one frequent scheduler as the primary caller. The database claim functions protect against overlapping claims, but duplicate scheduler invocations still consume function/action usage.

## Verification
1. Deploy the updated project.
2. Set the secrets above.
3. Manually run the GitHub workflow or invoke the endpoint with the CRON_SECRET.
4. Expect HTTP 200 and a JSON response containing `claimed`, `results`, and `workflowRuns`.
5. Create a test lead and a disabled test workflow; enable it only after confirming consent and delivery settings.
6. Create a test workflow with a 2-minute wait and verify its next step runs after the scheduler's next polling cycle.

## Production caveats
- This package cannot connect provider accounts, apply Supabase migrations, set Vercel secrets, or run production E2E without access to those accounts.
- Email, WhatsApp, Meta, LinkedIn and YouTube need valid provider credentials and approved permissions.
- Do not enable outbound workflows until test contacts, consent, opt-out and delivery confirmation are verified.
