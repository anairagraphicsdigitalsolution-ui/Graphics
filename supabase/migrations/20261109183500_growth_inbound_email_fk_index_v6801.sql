-- Cover the created_by foreign key on tenant inbound email address records.
create index if not exists growth_inbound_email_addresses_created_by_idx
 on public.growth_inbound_email_addresses(created_by);
