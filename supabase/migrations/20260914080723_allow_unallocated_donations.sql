-- A donation can be received before a school is selected. Existing ownership
-- policies and the unique external reference continue to protect these rows.
alter table public.ledger_transactions alter column school_id drop not null;
alter table public.ledger_transactions add constraint unallocated_contribution_check
  check (school_id is not null or
    (type = 'contribution' and user_id is not null and amount_cents > 0
     and commitment_id is null and project_id is null));
