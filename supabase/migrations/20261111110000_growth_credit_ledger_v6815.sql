-- Credit ledger ceiling for each tenant contract. Confirmed payments remain the source of truth for paid totals.
alter table public.growth_subscriptions
  add column if not exists credit_limit_minor bigint not null default 0
  check (credit_limit_minor >= 0);
comment on column public.growth_subscriptions.credit_limit_minor is
  'Agreed total contract/credit amount in minor currency units. Outstanding = max(credit_limit_minor - confirmed payments, 0).';
