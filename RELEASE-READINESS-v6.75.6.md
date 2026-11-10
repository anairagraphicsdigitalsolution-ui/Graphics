# Anaira AI Growth Engine v6.75.6 — Queue Crash Recovery

## Engineering change
A production failure mode was identified in the original queue claim RPC: if a serverless worker died after claiming a job, the job could remain `processing` indefinitely because the original claim function only selected `queued` jobs.

This release adds migration `20261109160539_growth_job_stale_lock_recovery_v6756.sql`:
- Detects jobs whose processing lock is older than 10 minutes.
- Requeues recoverable jobs with bounded exponential backoff.
- Marks jobs failed when their retry budget is exhausted.
- Keeps atomic `FOR UPDATE SKIP LOCKED` claiming.
- Keeps the claim RPC executable only by `service_role`.

## Validation
- Run `npm run verify:all` after dependencies are available (the scripts use Node built-ins).
- Static regression tests verify the recovery migration's key safeguards.
- This migration has NOT been applied to the live Supabase project in this environment.

## Still required for production sign-off
- Apply migration to Supabase and inspect migration history.
- Complete `npm install` and `npm run build`.
- Configure one frequent worker scheduler and test real due-job execution.
- Verify provider credentials, OAuth refresh, webhooks and message/publishing delivery.
- Run tenant-isolation/RLS and end-to-end acceptance tests.


## Supabase deployment record
- Applied to project `nrsdqrqkffhbicfskilb` on 2026-11-09; remote migration version `20261109160539`.
- Verified the recovery index exists, the updated RPC contains the recovery logic, `service_role` can execute it, and `authenticated` cannot.
