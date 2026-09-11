-- Applied to production as migration: make_commitment_insert_idempotent
-- Re-submitting a school's monthly intent updates the existing commitment instead of duplicating it.

create or replace function private.commitment_insert_idempotency()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  update public.commitments
     set amount_cents = new.amount_cents,
         currency = new.currency,
         frequency = new.frequency,
         status = new.status,
         payment_provider = new.payment_provider,
         provider_reference = new.provider_reference,
         cancelled_at = null,
         updated_at = now()
   where user_id = new.user_id
     and school_id = new.school_id;

  if found then return null; end if;
  return new;
end;
$$;

drop trigger if exists commitment_insert_idempotency on public.commitments;
create trigger commitment_insert_idempotency
before insert on public.commitments
for each row execute function private.commitment_insert_idempotency();
