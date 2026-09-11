-- Skolo Saka foundational schema.
-- Primary/high schools, alumni memberships, monthly commitments, projects and auditable ledger.

create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

create type public.school_level as enum ('primary','high','combined','other');
create type public.membership_role as enum ('alumnus','parent','staff','supporter');
create type public.commitment_status as enum ('pending','active','paused','cancelled');
create type public.project_status as enum ('submitted','verification','approved','fundraising','funded','procurement','implementation','completed','audited','cancelled');
create type public.transaction_type as enum ('contribution','refund','platform_fee','allocation','project_expense','adjustment');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  phone text unique,
  full_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.schools (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  level public.school_level not null,
  emis_number text unique,
  province text not null,
  municipality text,
  town text,
  verified boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.school_memberships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  school_id uuid not null references public.schools(id) on delete cascade,
  role public.membership_role not null default 'alumnus',
  start_year integer check (start_year between 1900 and 2200),
  end_year integer check (end_year between 1900 and 2200),
  graduation_year integer check (graduation_year between 1900 and 2200),
  verified boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.commitments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  school_id uuid not null references public.schools(id) on delete cascade,
  amount_cents bigint not null check (amount_cents >= 1000),
  currency char(3) not null default 'ZAR',
  frequency text not null default 'monthly' check (frequency = 'monthly'),
  status public.commitment_status not null default 'pending',
  payment_provider text,
  provider_reference text,
  started_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  title text not null,
  description text,
  category text,
  target_cents bigint not null check (target_cents > 0),
  status public.project_status not null default 'submitted',
  priority integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.project_updates (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  title text not null,
  body text not null,
  image_url text,
  published_at timestamptz not null default now()
);

create table public.ledger_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete set null,
  school_id uuid not null references public.schools(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,
  commitment_id uuid references public.commitments(id) on delete set null,
  type public.transaction_type not null,
  amount_cents bigint not null check (amount_cents <> 0),
  currency char(3) not null default 'ZAR',
  external_reference text,
  metadata jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table public.invites (
  id uuid primary key default gen_random_uuid(),
  inviter_user_id uuid not null references public.profiles(id) on delete cascade,
  school_id uuid not null references public.schools(id) on delete cascade,
  code text not null unique default encode(extensions.gen_random_bytes(8),'hex'),
  graduation_year integer,
  accepted_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  accepted_at timestamptz
);

create index schools_name_idx on public.schools(name);
create index schools_province_level_idx on public.schools(province,level);
create index commitments_school_status_idx on public.commitments(school_id,status);
create index ledger_school_date_idx on public.ledger_transactions(school_id,occurred_at desc);

alter table public.profiles enable row level security;
alter table public.schools enable row level security;
alter table public.school_memberships enable row level security;
alter table public.commitments enable row level security;
alter table public.projects enable row level security;
alter table public.project_updates enable row level security;
alter table public.ledger_transactions enable row level security;
alter table public.invites enable row level security;

create policy "users read own profile" on public.profiles for select using (auth.uid() = id);
create policy "users update own profile" on public.profiles for update using (auth.uid() = id);
create policy "schools readable by everyone" on public.schools for select using (true);
create policy "users create own memberships" on public.school_memberships for insert with check (auth.uid() = user_id);
create policy "users read own memberships" on public.school_memberships for select using (auth.uid() = user_id);
create policy "users create own commitments" on public.commitments for insert with check (auth.uid() = user_id);
create policy "users read own commitments" on public.commitments for select using (auth.uid() = user_id);
create policy "projects readable by everyone" on public.projects for select using (status not in ('submitted','verification','cancelled'));
create policy "updates readable by everyone" on public.project_updates for select using (true);
create policy "users read own ledger" on public.ledger_transactions for select using (auth.uid() = user_id);
create policy "users manage own invites" on public.invites for all using (auth.uid() = inviter_user_id) with check (auth.uid() = inviter_user_id);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles(id, phone, full_name)
  values(new.id, new.phone, new.raw_user_meta_data ->> 'full_name');
  return new;
end;
$$;

revoke all on function public.handle_new_user() from public, anon, authenticated;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

grant select on public.schools, public.projects, public.project_updates to anon, authenticated;
grant select, update on public.profiles to authenticated;
grant select, insert on public.school_memberships, public.commitments, public.invites to authenticated;
grant select on public.ledger_transactions to authenticated;
