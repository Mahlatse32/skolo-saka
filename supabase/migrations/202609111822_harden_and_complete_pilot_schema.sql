-- Applied to production as migration: harden_and_complete_pilot_schema
-- Adds payment/provider boundary, expenditure evidence, documents, project votes,
-- public impact rollups, uniqueness rules and hardened RLS.

alter table public.profiles drop column if exists pin_hash;

drop policy if exists "users update own commitments" on public.commitments;
create policy "users update own commitments"
on public.commitments for update to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

alter policy "users create own commitments" on public.commitments to authenticated;
alter policy "users read own commitments" on public.commitments to authenticated;
alter policy "users manage own invites" on public.invites to authenticated;
alter policy "users read own ledger" on public.ledger_transactions to authenticated;
alter policy "users read own profile" on public.profiles to authenticated;
alter policy "users update own profile" on public.profiles to authenticated;
alter policy "users create own memberships" on public.school_memberships to authenticated;
alter policy "users read own memberships" on public.school_memberships to authenticated;

create unique index if not exists school_memberships_user_school_key on public.school_memberships(user_id, school_id);
create unique index if not exists commitments_user_school_active_key on public.commitments(user_id, school_id) where status in ('pending','active','paused');
create index if not exists commitments_school_idx on public.commitments(school_id);
create index if not exists projects_school_priority_idx on public.projects(school_id, priority, created_at desc);

create table if not exists public.payment_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  commitment_id uuid references public.commitments(id) on delete set null,
  provider text not null,
  provider_reference text,
  amount_cents bigint not null check (amount_cents > 0),
  currency char(3) not null default 'ZAR',
  status text not null check (status in ('created','pending','successful','failed','cancelled')),
  failure_reason text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.payment_attempts enable row level security;
create policy "users read own payment attempts" on public.payment_attempts for select to authenticated using (auth.uid() = user_id);

create table if not exists public.expenditures (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,
  supplier_name text not null,
  description text not null,
  amount_cents bigint not null check (amount_cents > 0),
  currency char(3) not null default 'ZAR',
  invoice_number text,
  paid_at timestamptz,
  status text not null default 'approved' check (status in ('proposed','approved','paid','void')),
  created_at timestamptz not null default now()
);
alter table public.expenditures enable row level security;
create policy "approved expenditures readable by everyone" on public.expenditures for select to anon, authenticated using (status in ('approved','paid'));

create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,
  expenditure_id uuid references public.expenditures(id) on delete set null,
  kind text not null check (kind in ('invoice','quote','receipt','photo','audit','other')),
  title text not null,
  file_url text not null,
  public boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.documents enable row level security;
create policy "public documents readable by everyone" on public.documents for select to anon, authenticated using (public = true);

create table if not exists public.project_votes (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique(project_id, user_id)
);
alter table public.project_votes enable row level security;
create policy "users read own votes" on public.project_votes for select to authenticated using (auth.uid() = user_id);
create policy "members vote on school projects" on public.project_votes for insert to authenticated
with check (auth.uid() = user_id and exists (
  select 1 from public.projects p join public.school_memberships sm on sm.school_id = p.school_id
  where p.id = project_id and sm.user_id = auth.uid()
));
create policy "users remove own votes" on public.project_votes for delete to authenticated using (auth.uid() = user_id);

create or replace view public.school_impact with (security_invoker = true) as
select s.id as school_id, s.name, s.level, s.province, s.town,
  count(distinct sm.user_id) as alumni_count,
  coalesce(sum(case when c.status = 'active' then c.amount_cents else 0 end),0)::bigint as monthly_commitment_cents,
  coalesce(sum(case when lt.type = 'contribution' then lt.amount_cents else 0 end),0)::bigint as total_contributed_cents
from public.schools s
left join public.school_memberships sm on sm.school_id = s.id
left join public.commitments c on c.school_id = s.id
left join public.ledger_transactions lt on lt.school_id = s.id
group by s.id;

grant select on public.school_impact to anon, authenticated;
grant select on public.schools, public.projects, public.project_updates, public.expenditures, public.documents to anon, authenticated;
grant select, insert, update on public.profiles, public.commitments to authenticated;
grant select, insert on public.school_memberships, public.invites, public.project_votes to authenticated;
grant delete on public.project_votes to authenticated;
grant select on public.ledger_transactions, public.payment_attempts to authenticated;
