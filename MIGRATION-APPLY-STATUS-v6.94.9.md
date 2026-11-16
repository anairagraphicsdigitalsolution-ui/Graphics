# Supabase Migration Apply Status — v6.94.9

- Target project: `nrsdqrqkffhbicfskilb`
- Project name: Anaira Graphics & Digital Solution
- Database engine: PostgreSQL 17
- Applied migrations:
- `growth_ai_sales_agent_inbound_call_queue_v6949` — `20261115140404`
- `growth_ai_sales_agent_call_session_privacy_v6949` — `20261115140759`
- `growth_ai_sales_agent_call_session_privacy_hardening_v6949b` — `20261115140807`
- Supabase migration apply result: success

## Live catalog verification

Both indexes are present in `pg_indexes`. The call-session SELECT policy is restricted to `private.is_growth_manager(organization_id)` or platform admin; the older member-wide read policy was removed.

- `growth_wa_inbound_call_queue_v6949_idx` — `(organization_id, created_at)` for inbound ringing calls.
- `growth_wa_call_provider_lookup_v6949_idx` — `(organization_id, whatsapp_call_id)` when the provider call ID exists.

Existing live calling tables were also inspected. The actual schema uses `direction`, `whatsapp_call_id`, `call_metadata`, `provider_error`, `connected_at`, and `ended_at`; the application routes have been aligned to these live names and the database's accepted call statuses.

No call records were created or modified during verification. No provider call was placed.
