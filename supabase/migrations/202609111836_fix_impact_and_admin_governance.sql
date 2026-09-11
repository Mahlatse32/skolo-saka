-- Applied production follow-up: correct aggregate math, make commitment saves idempotent,
-- and add explicit school/platform administration with audit records.

drop index if exists public.commitments_user_school_active_key;
create unique index if not exists commitments_user_school_key on public.commitments(user_id, school_id);

create or replace view public.school_impact with (security_invoker = true) as
select s.id as school_id, s.name, s.level, s.province, s.town,
  (select count(distinct sm.user_id) from public.school_memberships sm where sm.school_id=s.id) as alumni_count,
  coalesce((select sum(c.amount_cents) from public.commitments c where c.school_id=s.id and c.status='active'),0)::bigint as monthly_commitment_cents,
  coalesce((select sum(lt.amount_cents) from public.ledger_transactions lt where lt.school_id=s.id and lt.type='contribution'),0)::bigint as total_contributed_cents
from public.schools s;
grant select on public.school_impact to anon, authenticated;

create table if not exists public.school_admins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  school_id uuid not null references public.schools(id) on delete cascade,
  role text not null default 'editor' check (role in ('owner','finance','editor')),
  status text not null default 'pending' check (status in ('pending','active','revoked')),
  created_at timestamptz not null default now(),
  unique(user_id,school_id)
);
alter table public.school_admins enable row level security;
create policy "admins read own school roles" on public.school_admins for select to authenticated using ((select auth.uid())=user_id);

create table if not exists public.platform_admins (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.platform_admins enable row level security;
create policy "platform admins read own role" on public.platform_admins for select to authenticated using ((select auth.uid())=user_id);

create table if not exists public.audit_events (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references public.profiles(id) on delete set null,
  school_id uuid references public.schools(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
alter table public.audit_events enable row level security;

create schema if not exists private;
create or replace function private.is_school_admin(target_school uuid)
returns boolean language sql stable security invoker set search_path='' as $$
  select exists(select 1 from public.school_admins sa where sa.user_id=(select auth.uid()) and sa.school_id=target_school and sa.status='active');
$$;
create or replace function private.is_platform_admin()
returns boolean language sql stable security invoker set search_path='' as $$
  select exists(select 1 from public.platform_admins pa where pa.user_id=(select auth.uid()));
$$;

create policy "school admins create projects" on public.projects for insert to authenticated with check (private.is_school_admin(school_id) or private.is_platform_admin());
create policy "school admins update projects" on public.projects for update to authenticated using (private.is_school_admin(school_id) or private.is_platform_admin()) with check (private.is_school_admin(school_id) or private.is_platform_admin());
create policy "school admins create project updates" on public.project_updates for insert to authenticated with check (exists(select 1 from public.projects p where p.id=project_id and (private.is_school_admin(p.school_id) or private.is_platform_admin())));
create policy "school admins create expenditures" on public.expenditures for insert to authenticated with check (private.is_school_admin(school_id) or private.is_platform_admin());
create policy "school admins update expenditures" on public.expenditures for update to authenticated using (private.is_school_admin(school_id) or private.is_platform_admin()) with check (private.is_school_admin(school_id) or private.is_platform_admin());
create policy "school admins create documents" on public.documents for insert to authenticated with check (private.is_school_admin(school_id) or private.is_platform_admin());
create policy "admins read related audit events" on public.audit_events for select to authenticated using (private.is_platform_admin() or (school_id is not null and private.is_school_admin(school_id)) or actor_user_id=(select auth.uid()));

create index if not exists school_admins_school_idx on public.school_admins(school_id);
create index if not exists audit_events_school_created_idx on public.audit_events(school_id,created_at desc);
create index if not exists audit_events_actor_idx on public.audit_events(actor_user_id);

grant select on public.school_admins,public.platform_admins,public.audit_events to authenticated;
grant insert,update on public.projects,public.expenditures to authenticated;
grant insert on public.project_updates,public.documents to authenticated;
