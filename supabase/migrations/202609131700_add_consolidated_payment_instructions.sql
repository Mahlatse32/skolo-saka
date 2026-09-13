-- Consolidated user payment instructions.
-- One recurring instruction can fund several schools (for example primary + high school)
-- while producing one provider subscription/debit and split ledger allocations.

create table if not exists public.payment_instructions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null check (kind in ('one_off','recurring')),
  cadence text check (cadence is null or cadence = 'monthly'),
  term_months integer check (term_months is null or term_months between 1 and 1200),
  amount_cents bigint not null check (amount_cents >= 1000),
  currency char(3) not null default 'ZAR',
  status text not null default 'pending' check (status in ('pending','active','non_renewing','cancelled','completed','failed')),
  provider text not null default 'paystack',
  provider_plan_code text,
  provider_subscription_code text,
  provider_email_token text,
  provider_reference text,
  next_payment_at timestamptz,
  started_at timestamptz,
  cancelled_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((kind = 'one_off' and cadence is null and term_months is null)
      or (kind = 'recurring' and cadence = 'monthly'))
);

create table if not exists public.payment_instruction_allocations (
  id uuid primary key default gen_random_uuid(),
  payment_instruction_id uuid not null references public.payment_instructions(id) on delete cascade,
  school_id uuid not null references public.schools(id) on delete restrict,
  commitment_id uuid references public.commitments(id) on delete set null,
  amount_cents bigint not null check (amount_cents >= 1000),
  created_at timestamptz not null default now(),
  unique(payment_instruction_id, school_id)
);

alter table public.commitments
  add column if not exists payment_instruction_id uuid references public.payment_instructions(id) on delete set null;

create index if not exists payment_instructions_user_status_idx
  on public.payment_instructions(user_id, status, created_at desc);
create unique index if not exists payment_instructions_subscription_code_uidx
  on public.payment_instructions(provider_subscription_code)
  where provider_subscription_code is not null;
create index if not exists payment_instructions_reference_idx
  on public.payment_instructions(provider_reference)
  where provider_reference is not null;
create index if not exists payment_instruction_allocations_instruction_idx
  on public.payment_instruction_allocations(payment_instruction_id);
create index if not exists payment_instruction_allocations_school_idx
  on public.payment_instruction_allocations(school_id);
create index if not exists commitments_payment_instruction_idx
  on public.commitments(payment_instruction_id)
  where payment_instruction_id is not null;

alter table public.payment_instructions enable row level security;
alter table public.payment_instruction_allocations enable row level security;

-- These tables are intentionally server-managed. The browser does not receive the
-- provider email token used to cancel subscriptions. API routes authenticate the user
-- and use the service role for controlled reads/writes.
revoke all on public.payment_instructions from anon, authenticated;
revoke all on public.payment_instruction_allocations from anon, authenticated;

comment on table public.payment_instructions is 'One user payment instruction; recurring instructions may fund multiple schools through one provider subscription.';
comment on column public.payment_instructions.provider_email_token is 'Paystack subscription management token. Server-only; never expose to the browser.';
comment on table public.payment_instruction_allocations is 'School-level split of a consolidated payment instruction.';
