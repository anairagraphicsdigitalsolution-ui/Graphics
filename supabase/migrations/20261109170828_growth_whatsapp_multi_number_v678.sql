-- Allow multiple verified WhatsApp phone numbers per tenant while keeping each
-- Meta phone_number_id globally unique and credentials private to service_role.
alter table public.growth_whatsapp_connections
  drop constraint if exists growth_whatsapp_connections_organization_id_key;

create index if not exists growth_whatsapp_connections_org_status_idx
  on public.growth_whatsapp_connections(organization_id, connection_status, created_at);

alter table public.growth_conversations
  add column if not exists channel_phone_number_id text;

create index if not exists growth_conversations_whatsapp_endpoint_idx
  on public.growth_conversations(organization_id, channel, visitor_id, channel_phone_number_id);

comment on column public.growth_conversations.channel_phone_number_id is
  'Receiving WhatsApp Business phone_number_id; selects the correct tenant-owned sender for replies.';
