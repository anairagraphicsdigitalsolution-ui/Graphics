-- v6.94.9: support low-latency inbound WhatsApp call queue and provider callback lookup.
-- The live project uses the established LiveKit-compatible schema (direction,
-- whatsapp_call_id, call_metadata); this migration is additive and non-destructive.
create index if not exists growth_wa_inbound_call_queue_v6949_idx
  on public.growth_whatsapp_call_sessions (organization_id, created_at asc)
  where direction = 'inbound' and call_status = 'ringing';

create index if not exists growth_wa_call_provider_lookup_v6949_idx
  on public.growth_whatsapp_call_sessions (organization_id, whatsapp_call_id)
  where whatsapp_call_id is not null;
