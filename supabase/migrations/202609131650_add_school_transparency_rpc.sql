-- Public, privacy-preserving school financial transparency.
-- Exposes aggregates and anonymous contribution activity without user ids.

create or replace function public.get_school_transparency(p_school_id uuid)
returns jsonb
language sql
security definer
set search_path = ''
as $$
with school as (
  select s.id, s.name, s.level, s.province, s.municipality, s.town, s.verified
  from public.schools s
  where s.id = p_school_id
),
contrib as (
  select lt.id, lt.amount_cents, lt.occurred_at, lt.project_id
  from public.ledger_transactions lt
  where lt.school_id = p_school_id
    and lt.type = 'contribution'::public.transaction_type
    and lt.amount_cents > 0
),
ranked as (
  select c.*, row_number() over(order by c.amount_cents desc, c.occurred_at desc) as amount_rank
  from contrib c
),
spent as (
  select e.id, e.project_id, e.supplier_name, e.description, e.amount_cents, e.currency, e.invoice_number, e.paid_at, e.status, e.created_at
  from public.expenditures e
  where e.school_id = p_school_id
    and e.status in ('approved','paid')
),
projects as (
  select p.id,p.title,p.description,p.category,p.target_cents,p.status,p.priority,p.created_at,p.updated_at,
         coalesce(sum(case when lt.type in ('contribution'::public.transaction_type,'allocation'::public.transaction_type) and lt.amount_cents > 0 then lt.amount_cents else 0 end),0)::bigint as raised_cents,
         coalesce((select sum(e.amount_cents)::bigint from public.expenditures e where e.project_id=p.id and e.status='paid'),0)::bigint as spent_cents
  from public.projects p
  left join public.ledger_transactions lt on lt.project_id=p.id
  where p.school_id=p_school_id
    and p.status not in ('submitted'::public.project_status,'verification'::public.project_status,'cancelled'::public.project_status)
  group by p.id
)
select jsonb_build_object(
  'school', (select to_jsonb(school) from school),
  'totals', jsonb_build_object(
    'contributions_cents', coalesce((select sum(amount_cents) from contrib),0),
    'spending_cents', coalesce((select sum(amount_cents) from spent where status='paid'),0),
    'approved_spending_cents', coalesce((select sum(amount_cents) from spent),0),
    'balance_cents', coalesce((select sum(amount_cents) from contrib),0) - coalesce((select sum(amount_cents) from spent where status='paid'),0),
    'contribution_count', (select count(*) from contrib),
    'project_count', (select count(*) from projects)
  ),
  'top_contributions', coalesce((select jsonb_agg(jsonb_build_object('amount_cents',amount_cents,'occurred_at',occurred_at,'rank',amount_rank) order by amount_rank) from ranked where amount_rank<=5),'[]'::jsonb),
  'latest_contributions', coalesce((select jsonb_agg(jsonb_build_object('amount_cents',amount_cents,'occurred_at',occurred_at) order by occurred_at desc) from (select amount_cents,occurred_at from ranked where amount_rank>5 order by occurred_at desc limit 25) q),'[]'::jsonb),
  'spending', coalesce((select jsonb_agg(jsonb_build_object('id',id,'project_id',project_id,'supplier_name',supplier_name,'description',description,'amount_cents',amount_cents,'currency',currency,'invoice_number',invoice_number,'paid_at',paid_at,'status',status,'created_at',created_at) order by coalesce(paid_at,created_at) desc) from spent),'[]'::jsonb),
  'projects', coalesce((select jsonb_agg(to_jsonb(projects) order by priority desc, updated_at desc) from projects),'[]'::jsonb)
);
$$;

grant execute on function public.get_school_transparency(uuid) to anon, authenticated;
