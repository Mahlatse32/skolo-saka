-- Paystack ledger writes use ON CONFLICT (external_reference).
-- A partial unique index cannot be used as that conflict target without the same predicate,
-- so replace the duplicate partial indexes with one ordinary UNIQUE index.
drop index if exists public.ledger_external_reference_unique;
drop index if exists public.ledger_external_reference_unique_idx;

create unique index if not exists ledger_external_reference_unique_idx
  on public.ledger_transactions (external_reference);
