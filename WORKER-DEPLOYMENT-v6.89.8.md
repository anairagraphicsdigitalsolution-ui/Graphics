# Growth Worker Deployment — v6.89.8

The worker is responsible for queued email/WhatsApp jobs, workflow runs, autonomous schedules and recovery. It must be invoked on a recurring cadence; the worker route itself is protected by `CRON_SECRET` and rejects requests without the exact Bearer token.

## Deployment options

### Vercel Hobby

The default `vercel.json` retains a once-daily schedule (`0 3 * * *`) for Hobby compatibility. This is only suitable for basic demos or non-time-sensitive testing. Queued messages, follow-ups and automation may be delayed until the next daily run.

### Vercel Pro / Enterprise

Use the production cadence in `vercel.pro.json` (`* * * * *`) by copying its `crons` value into `vercel.json` before deployment. Vercel documents per-minute cron schedules for Pro/Enterprise.

### GitHub Actions fallback

The repository already contains `.github/workflows/anaira-growth-worker.yml`, scheduled every five minutes. Configure these GitHub repository Actions secrets:

- `ANAIRA_GROWTH_SITE_URL` — production base URL, e.g. `https://your-production-domain`.
- `ANAIRA_GROWTH_CRON_SECRET` — must exactly match Vercel Production `CRON_SECRET`.

The workflow also supports manual `workflow_dispatch`. Scheduled GitHub Actions may be delayed by GitHub; monitor its run history and the Vercel worker logs.

## Required production environment

- `CRON_SECRET` — strong random secret.
- `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- Provider keys and connected workspace credentials for enabled modules.

After configuring Vercel environment variables, redeploy. Verify at least one successful worker invocation before turning on live campaigns.

## Operational validation

1. Invoke the worker from the Vercel cron or GitHub Actions schedule and verify HTTP success.
2. Confirm a test workflow run advances to succeeded or a terminal, diagnosable state.
3. Confirm a controlled email/WhatsApp send with an explicitly consented test recipient.
4. Monitor failed jobs and workflow dead letters.
5. Do not equate schedule registration with proof of live provider delivery.
