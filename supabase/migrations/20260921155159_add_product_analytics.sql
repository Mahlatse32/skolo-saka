-- Privacy-conscious first-party product analytics for Skolo Saka.
-- Browsers never receive table access: events are accepted by the validated
-- Next.js endpoint and analytics are read through a service-role-only RPC.

create table public.analytics_events (
  id bigint generated always as identity primary key,
  occurred_at timestamptz not null default now(),
  visitor_id uuid,
  session_id uuid,
  user_id uuid references public.profiles(id) on delete set null,
  event_name text not null check (event_name ~ '^[a-z][a-z0-9_]{1,63}$'),
  page_path text not null check (char_length(page_path) between 1 and 240),
  referrer_host text check (referrer_host is null or char_length(referrer_host) <= 160),
  device_type text not null default 'unknown' check (device_type in ('mobile','tablet','desktop','unknown')),
  properties jsonb not null default '{}'::jsonb check (jsonb_typeof(properties) = 'object')
);

comment on table public.analytics_events is 'Privacy-conscious navigation and product events. No PIN, OTP, card, phone, email, raw IP or free-text field values.';

create index analytics_events_occurred_idx on public.analytics_events(occurred_at desc);
create index analytics_events_visitor_occurred_idx on public.analytics_events(visitor_id, occurred_at desc);
create index analytics_events_user_occurred_idx on public.analytics_events(user_id, occurred_at desc) where user_id is not null;
create index analytics_events_name_occurred_idx on public.analytics_events(event_name, occurred_at desc);

alter table public.analytics_events enable row level security;
revoke all on public.analytics_events from anon, authenticated;
grant select, insert on public.analytics_events to service_role;
grant usage, select on sequence public.analytics_events_id_seq to service_role;

create or replace function public.platform_analytics_summary(p_days integer default 30)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  with bounds as (
    select
      greatest(1, least(coalesce(p_days, 30), 365)) as days,
      now() - make_interval(days => greatest(1, least(coalesce(p_days, 30), 365))) as since
  ),
  filtered as (
    select e.* from public.analytics_events e, bounds b where e.occurred_at >= b.since
  ),
  totals as (
    select
      (select count(*) from public.profiles) as registered_users,
      (select count(*) from public.profiles p, bounds b where p.created_at >= b.since) as new_users,
      count(distinct visitor_id) filter (where visitor_id is not null) as unique_visitors,
      count(distinct session_id) filter (where session_id is not null) as sessions,
      count(*) filter (where event_name = 'page_view') as page_views,
      count(*) filter (where event_name <> 'page_view') as actions,
      count(distinct user_id) filter (where user_id is not null) as active_users
    from filtered
  ),
  days as (
    select generate_series(
      (now() at time zone 'Africa/Johannesburg')::date - ((select days from bounds) - 1),
      (now() at time zone 'Africa/Johannesburg')::date,
      interval '1 day'
    )::date as day
  ),
  daily as (
    select d.day,
      count(distinct f.visitor_id) filter (where f.visitor_id is not null) as visitors,
      count(*) filter (where f.event_name = 'page_view') as page_views,
      count(*) filter (where f.event_name <> 'page_view') as actions
    from days d left join filtered f on (f.occurred_at at time zone 'Africa/Johannesburg')::date = d.day
    group by d.day order by d.day
  ),
  hours as (
    select h.hour,
      count(distinct f.session_id) filter (where f.session_id is not null) as sessions,
      count(f.id) as events
    from generate_series(0, 23) h(hour)
    left join filtered f on extract(hour from f.occurred_at at time zone 'Africa/Johannesburg')::int = h.hour
    group by h.hour order by h.hour
  ),
  top_pages as (
    select page_path, count(*) as views, count(distinct visitor_id) as visitors
    from filtered where event_name = 'page_view'
    group by page_path order by views desc, page_path limit 10
  ),
  top_actions as (
    select event_name, count(*) as total, count(distinct visitor_id) as visitors
    from filtered where event_name <> 'page_view'
    group by event_name order by total desc, event_name limit 12
  ),
  funnel as (
    select * from (values
      (1, 'Visited', (select count(distinct visitor_id) from filtered where visitor_id is not null)),
      (2, 'Signed in', (select count(distinct visitor_id) from filtered where event_name = 'sign_in_success')),
      (3, 'Searched schools', (select count(distinct visitor_id) from filtered where event_name = 'school_search')),
      (4, 'Started checkout', (select count(distinct visitor_id) from filtered where event_name = 'checkout_started')),
      (5, 'Reached payment complete', (select count(distinct visitor_id) from filtered where event_name = 'payment_complete_view'))
    ) as x(position, label, visitors)
  )
  select jsonb_build_object(
    'days', (select days from bounds), 'generatedAt', now(),
    'totals', (select to_jsonb(totals) from totals),
    'daily', coalesce((select jsonb_agg(to_jsonb(daily) order by day) from daily), '[]'::jsonb),
    'hours', coalesce((select jsonb_agg(to_jsonb(hours) order by hour) from hours), '[]'::jsonb),
    'topPages', coalesce((select jsonb_agg(to_jsonb(top_pages)) from top_pages), '[]'::jsonb),
    'topActions', coalesce((select jsonb_agg(to_jsonb(top_actions)) from top_actions), '[]'::jsonb),
    'funnel', coalesce((select jsonb_agg(to_jsonb(funnel) order by position) from funnel), '[]'::jsonb)
  );
$$;

revoke all on function public.platform_analytics_summary(integer) from public, anon, authenticated;
grant execute on function public.platform_analytics_summary(integer) to service_role;
