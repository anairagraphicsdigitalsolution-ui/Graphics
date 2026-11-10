# Workflow Dead-Letter Queue — v6.80.4

## Database
Apply `supabase/migrations/20261110120000_growth_workflow_dead_letter_queue_v6804.sql` to the AI Growth Engine Supabase project before deploying this version.

## Runtime
When a workflow run reaches its terminal retry failure, the worker writes a durable record to `growth_workflow_dead_letters` (unique per run). The record includes tenant, workflow, lead, error, attempt count and failure timestamp.

## API
- `GET /api/growth/automation/dead-letters?organizationId=<id>&status=open|retried|discarded|all`
  - Workspace members can inspect the queue.
- `PATCH /api/growth/automation/dead-letters`
  - Body `{ "organizationId": "...", "id": "...", "action": "retry" }` queues a manual retry.
  - Body `{ "organizationId": "...", "id": "...", "action": "discard" }` marks the item discarded.
  - Retry/discard require owner or manager role.
  - Resolved items cannot be acted on again.

The API is tenant-scoped and the table uses RLS. Worker inserts use the service role. Do not grant anonymous access.

## Verification
`npm run verify:growth-workflow-dlq` covers persistence, idempotency, tenant scope, RLS, manager gating, retry reset, discard and repeat-resolution protection.
