-- Atomically update a recurring instruction and proportionally rebalance its
-- school allocations. This is server-only; the API authenticates ownership
-- before calling it with the service role.
create or replace function public.change_payment_instruction_amount(
  p_instruction_id uuid,
  p_amount_cents bigint
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_old_amount bigint;
  v_allocation_count bigint;
  v_allocation_total bigint;
begin
  if p_amount_cents < 1000 or p_amount_cents > 100000000 then
    raise exception 'Payment amount is outside the allowed range';
  end if;

  select amount_cents into v_old_amount
  from public.payment_instructions
  where id = p_instruction_id and kind = 'recurring' and status = 'active'
  for update;

  if v_old_amount is null then
    raise exception 'Active monthly payment not found';
  end if;

  select count(*), coalesce(sum(amount_cents), 0)
  into v_allocation_count, v_allocation_total
  from public.payment_instruction_allocations
  where payment_instruction_id = p_instruction_id;

  if v_allocation_count > 0 and v_allocation_total <> v_old_amount then
    raise exception 'Payment allocations do not match the instruction total';
  end if;
  if p_amount_cents < v_allocation_count * 1000 then
    raise exception 'Each school allocation must be at least R10';
  end if;

  update public.payment_instructions
  set amount_cents = p_amount_cents, updated_at = now()
  where id = p_instruction_id;

  with weighted as (
    select id,
      1000 + floor(
        amount_cents::numeric
        * (p_amount_cents - count(*) over () * 1000)
        / v_old_amount
      )::bigint as base_amount,
      (amount_cents::numeric * (p_amount_cents - count(*) over () * 1000) / v_old_amount)
        - floor(amount_cents::numeric * (p_amount_cents - count(*) over () * 1000) / v_old_amount) as fraction
    from public.payment_instruction_allocations
    where payment_instruction_id = p_instruction_id
  ), ranked as (
    select id, base_amount,
      row_number() over (order by fraction desc, id) as remainder_rank,
      p_amount_cents - sum(base_amount) over () as remainder
    from weighted
  )
  update public.payment_instruction_allocations allocation
  set amount_cents = ranked.base_amount
    + case when ranked.remainder_rank <= ranked.remainder then 1 else 0 end
  from ranked
  where allocation.id = ranked.id;

  update public.commitments commitment
  set amount_cents = allocation.amount_cents, updated_at = now()
  from public.payment_instruction_allocations allocation
  where allocation.payment_instruction_id = p_instruction_id
    and allocation.commitment_id = commitment.id;
end;
$$;

revoke all on function public.change_payment_instruction_amount(uuid, bigint) from public, anon, authenticated;
grant execute on function public.change_payment_instruction_amount(uuid, bigint) to service_role;

comment on function public.change_payment_instruction_amount(uuid, bigint) is
  'Server-only atomic update for a recurring payment total and its proportional school allocations.';
