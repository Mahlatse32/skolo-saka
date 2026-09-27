-- Apply to the isolated UAT database only. Promote separately after review.
-- RLS does not protect TRUNCATE. Remove inherited broad grants, not just DML.
revoke all on public.platform_admins, public.school_admins,
  public.sports_admin_assignments, public.sports_audit_log
  from public, anon, authenticated;
grant select on public.platform_admins, public.school_admins,
  public.sports_admin_assignments to authenticated;

revoke insert, update, delete, truncate, references, trigger on
  public.sports_teams, public.sports_players, public.sports_team_players,
  public.sports_matches, public.sports_match_events
  from public, anon, authenticated;

alter table public.platform_admins enable row level security;
alter table public.school_admins enable row level security;
alter table public.sports_admin_assignments enable row level security;
alter table public.sports_audit_log enable row level security;

revoke all on public.analytics_events from public, anon, authenticated;
revoke all on function public.platform_analytics_summary(integer) from public, anon, authenticated;
grant execute on function public.platform_analytics_summary(integer) to service_role;
