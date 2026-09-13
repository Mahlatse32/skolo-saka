alter table public.commitments
  add column if not exists payment_plan_code text,
  add column if not exists payment_subscription_code text;

create unique index if not exists ledger_external_reference_unique_idx
  on public.ledger_transactions(external_reference)
  where external_reference is not null;

create index if not exists commitments_payment_plan_code_idx
  on public.commitments(payment_plan_code)
  where payment_plan_code is not null;

create index if not exists commitments_payment_subscription_code_idx
  on public.commitments(payment_subscription_code)
  where payment_subscription_code is not null;

comment on column public.commitments.payment_plan_code is 'Payment provider recurring plan identifier; never a secret.';
comment on column public.commitments.payment_subscription_code is 'Payment provider subscription identifier; never a card/bank credential.';
