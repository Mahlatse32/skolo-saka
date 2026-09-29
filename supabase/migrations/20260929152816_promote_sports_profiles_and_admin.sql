create type public.sport_code as enum ('football','netball','rugby');
create type public.match_status as enum ('scheduled','live','pending_confirmation','official','disputed','cancelled');
create type public.sports_admin_role as enum ('super_admin','school_admin','coach','match_official');

create table public.sports_teams (
 id uuid primary key default gen_random_uuid(), school_id uuid not null references public.schools(id) on delete cascade, sport public.sport_code not null, name text not null, age_group text not null, gender text, season_year integer not null check (season_year between 2026 and 2200), created_at timestamptz not null default now(), unique(school_id,sport,age_group,gender,season_year)
);
create table public.sports_players (
 id uuid primary key default gen_random_uuid(), school_id uuid not null references public.schools(id) on delete cascade, first_name text not null, last_name text not null, birth_year integer check (birth_year between 1990 and 2200), public_age integer check (public_age between 5 and 25), position text, photo_url text, public_profile boolean not null default false, guardian_consent_at timestamptz, created_at timestamptz not null default now()
);
create table public.sports_team_players (
 team_id uuid not null references public.sports_teams(id) on delete cascade, player_id uuid not null references public.sports_players(id) on delete cascade, shirt_number integer, primary key(team_id,player_id)
);
create table public.sports_matches (
 id uuid primary key default gen_random_uuid(), home_team_id uuid not null references public.sports_teams(id), away_team_id uuid not null references public.sports_teams(id), starts_at timestamptz not null, venue text, status public.match_status not null default 'scheduled', home_score integer not null default 0 check(home_score>=0), away_score integer not null default 0 check(away_score>=0), player_of_match_id uuid references public.sports_players(id), submitted_by uuid references public.profiles(id), submitted_at timestamptz, confirmed_by uuid references public.profiles(id), confirmed_at timestamptz, created_at timestamptz not null default now(), check(home_team_id <> away_team_id)
);
create table public.sports_match_events (
 id uuid primary key default gen_random_uuid(), match_id uuid not null references public.sports_matches(id) on delete cascade, team_id uuid not null references public.sports_teams(id), player_id uuid references public.sports_players(id), event_type text not null check(event_type in ('goal','assist','yellow_card','red_card','netball_goal','substitution')), minute integer check(minute between 0 and 200), detail text, created_by uuid references public.profiles(id), created_at timestamptz not null default now()
);
create table public.sports_admin_assignments (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles(id) on delete cascade, role public.sports_admin_role not null, school_id uuid references public.schools(id) on delete cascade, team_id uuid references public.sports_teams(id) on delete cascade, active boolean not null default true, created_at timestamptz not null default now(), unique(user_id,role,school_id,team_id)
);
create table public.sports_audit_log (
 id bigint generated always as identity primary key, actor_user_id uuid references public.profiles(id), action text not null, entity_type text not null, entity_id uuid, before_data jsonb, after_data jsonb, created_at timestamptz not null default now()
);

create index sports_teams_school_idx on public.sports_teams(school_id,season_year);
create index sports_players_school_idx on public.sports_players(school_id);
create index sports_matches_teams_date_idx on public.sports_matches(home_team_id,away_team_id,starts_at desc);
create index sports_match_events_match_idx on public.sports_match_events(match_id,minute);
create index sports_admin_user_idx on public.sports_admin_assignments(user_id) where active;

alter table public.sports_teams enable row level security; alter table public.sports_players enable row level security; alter table public.sports_team_players enable row level security; alter table public.sports_matches enable row level security; alter table public.sports_match_events enable row level security; alter table public.sports_admin_assignments enable row level security; alter table public.sports_audit_log enable row level security;

create policy "sports teams public read" on public.sports_teams for select to anon, authenticated using(true);
create policy "consented player profiles public read" on public.sports_players for select to anon, authenticated using(public_profile and guardian_consent_at is not null);
create policy "team rosters public read" on public.sports_team_players for select to anon, authenticated using(exists(select 1 from public.sports_players p where p.id=player_id and p.public_profile and p.guardian_consent_at is not null));
create policy "sports matches public read" on public.sports_matches for select to anon, authenticated using(status in ('scheduled','live','pending_confirmation','official'));
create policy "sports events public read" on public.sports_match_events for select to anon, authenticated using(exists(select 1 from public.sports_matches m where m.id=match_id and m.status in ('live','pending_confirmation','official')));
create policy "admins read own assignment" on public.sports_admin_assignments for select to authenticated using((select auth.uid())=user_id);

create or replace function public.can_manage_sports(p_school_id uuid, p_team_id uuid default null) returns boolean language sql stable security invoker set search_path='' as $$ select exists(select 1 from public.sports_admin_assignments a where a.user_id=(select auth.uid()) and a.active and (a.role='super_admin' or (a.school_id=p_school_id and (a.role='school_admin' or (a.role='coach' and (p_team_id is null or a.team_id=p_team_id)))) or a.role='match_official')) $$;

create policy "sports admins manage teams" on public.sports_teams for all to authenticated using(public.can_manage_sports(school_id,id)) with check(public.can_manage_sports(school_id,id));
create policy "sports admins manage players" on public.sports_players for all to authenticated using(public.can_manage_sports(school_id,null)) with check(public.can_manage_sports(school_id,null));
create policy "sports admins manage roster" on public.sports_team_players for all to authenticated using(exists(select 1 from public.sports_teams t where t.id=team_id and public.can_manage_sports(t.school_id,t.id))) with check(exists(select 1 from public.sports_teams t where t.id=team_id and public.can_manage_sports(t.school_id,t.id)));
create policy "sports admins manage matches" on public.sports_matches for all to authenticated using(exists(select 1 from public.sports_teams t where t.id in(home_team_id,away_team_id) and public.can_manage_sports(t.school_id,t.id))) with check(exists(select 1 from public.sports_teams t where t.id in(home_team_id,away_team_id) and public.can_manage_sports(t.school_id,t.id)));
create policy "sports admins manage events" on public.sports_match_events for all to authenticated using(exists(select 1 from public.sports_teams t where t.id=team_id and public.can_manage_sports(t.school_id,t.id))) with check(exists(select 1 from public.sports_teams t where t.id=team_id and public.can_manage_sports(t.school_id,t.id)));

grant select on public.sports_teams, public.sports_players, public.sports_team_players, public.sports_matches, public.sports_match_events to anon, authenticated;
grant insert,update,delete on public.sports_teams, public.sports_players, public.sports_team_players, public.sports_matches, public.sports_match_events to authenticated;
grant select on public.sports_admin_assignments to authenticated;
grant execute on function public.can_manage_sports(uuid,uuid) to authenticated;
alter table public.profiles add column if not exists avatar_path text;
alter table public.sports_players add column if not exists user_id uuid references auth.users(id) on delete set null;
alter table public.sports_players add column if not exists photo_path text;
create unique index if not exists sports_players_user_id_unique on public.sports_players(user_id) where user_id is not null;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('profile-photos','profile-photos',false,3145728,array['image/webp']) on conflict(id) do update set public=false,file_size_limit=3145728,allowed_mime_types=array['image/webp'];

-- Reviewed production sports administration.
alter table public.sports_matches add column if not exists revision integer not null default 0;
alter table public.sports_matches add column if not exists submitted_team_id uuid references public.sports_teams(id);
-- Mutations go through the checked transactional RPC, never directly from clients.
revoke insert,update,delete on public.sports_teams,public.sports_players,public.sports_team_players,public.sports_matches,public.sports_match_events,public.sports_admin_assignments,public.sports_audit_log from anon,authenticated;
create schema if not exists sports_private;
revoke all on schema sports_private from public,anon,authenticated;
create or replace function sports_private.can_edit(actor uuid, school uuid, team uuid default null) returns boolean language sql stable security invoker set search_path='' as $$
 select exists(select 1 from public.sports_admin_assignments a where a.user_id=actor and a.active and (a.role='super_admin' or (a.role='school_admin' and a.school_id=school) or (a.role='coach' and team is not null and a.team_id=team and a.school_id=school)))
$$;
revoke all on function sports_private.can_edit(uuid,uuid,uuid) from public,anon,authenticated;
create or replace function sports_private.admin_mutate(action text,payload jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); super boolean; entity uuid; result jsonb; before_row jsonb; home public.sports_teams; away public.sports_teams; team public.sports_teams; match public.sports_matches; player public.sports_players; assignment public.sports_admin_assignments; side uuid; entity_type text;
begin
 if actor is null then raise exception 'Sign in required' using errcode='42501'; end if;
 select exists(select 1 from public.sports_admin_assignments where user_id=actor and active and role='super_admin') into super;
 if not exists(select 1 from public.sports_admin_assignments where user_id=actor and active and role in ('super_admin','school_admin','coach')) then raise exception 'Sports admin access required' using errcode='42501'; end if;
 if action='team_create' then
  if not sports_private.can_edit(actor,(payload->>'school_id')::uuid,null) then raise exception 'School access required' using errcode='42501'; end if;
  if length(trim(payload->>'name')) not between 2 and 100 or length(trim(payload->>'age_group')) not between 1 and 30 then raise exception 'Enter a team name and age group'; end if;
  insert into public.sports_teams(school_id,sport,name,age_group,gender,season_year) values((payload->>'school_id')::uuid,(payload->>'sport')::public.sport_code,trim(payload->>'name'),trim(payload->>'age_group'),payload->>'gender',(payload->>'season_year')::int) returning id,to_jsonb(sports_teams.*) into entity,result;
  entity_type:='team';
 elsif action='player_create' then
  select * into strict team from public.sports_teams where id=(payload->>'team_id')::uuid;
  if not sports_private.can_edit(actor,team.school_id,team.id) then raise exception 'Team access required' using errcode='42501'; end if;
  if length(trim(payload->>'first_name')) not between 1 and 70 or length(trim(payload->>'last_name')) not between 1 and 70 then raise exception 'Player name required'; end if;
  insert into public.sports_players(school_id,first_name,last_name,position,public_profile,guardian_consent_at) values(team.school_id,trim(payload->>'first_name'),trim(payload->>'last_name'),left(payload->>'position',70),coalesce((payload->>'publish')::boolean,false),case when coalesce((payload->>'publish')::boolean,false) then now() else null end) returning id,to_jsonb(sports_players.*) into entity,result;
  insert into public.sports_team_players(team_id,player_id,shirt_number) values(team.id,entity,nullif(payload->>'shirt_number','')::int);
  entity_type:='player';
 elsif action in ('roster_assign','roster_remove') then
  select * into strict team from public.sports_teams where id=(payload->>'team_id')::uuid;
  select * into strict player from public.sports_players where id=(payload->>'player_id')::uuid;
  if not sports_private.can_edit(actor,team.school_id,team.id) or player.school_id<>team.school_id then raise exception 'Player and managed team must belong to the same school' using errcode='42501'; end if;
  if not sports_private.can_edit(actor,player.school_id,null) and not (player.public_profile and player.guardian_consent_at is not null) and not exists(select 1 from public.sports_team_players r where r.player_id=player.id and sports_private.can_edit(actor,player.school_id,r.team_id)) then raise exception 'Player access required' using errcode='42501'; end if;
  select to_jsonb(r.*) into before_row from public.sports_team_players r where r.team_id=team.id and r.player_id=player.id;
  if action='roster_assign' then
   if nullif(payload->>'shirt_number','')::int not between 0 and 999 then raise exception 'Invalid shirt number'; end if;
   insert into public.sports_team_players(team_id,player_id,shirt_number) values(team.id,player.id,nullif(payload->>'shirt_number','')::int) on conflict(team_id,player_id) do update set shirt_number=excluded.shirt_number returning to_jsonb(sports_team_players.*) into result;
  else
   if exists(select 1 from public.sports_matches m where m.status in ('live','pending_confirmation') and team.id in (m.home_team_id,m.away_team_id)) then raise exception 'Finish active results before removing a player'; end if;
   delete from public.sports_team_players where team_id=team.id and player_id=player.id;
   result:=jsonb_build_object('team_id',team.id,'player_id',player.id,'removed',true);
  end if;
  entity:=player.id;entity_type:='roster';
 elsif action in ('photo_publish','photo_unpublish') then
  select * into strict player from public.sports_players where id=(payload->>'player_id')::uuid for update;
  if not sports_private.can_edit(actor,player.school_id,null) then raise exception 'School manager approval required' using errcode='42501'; end if;
  before_row:=to_jsonb(player);
  if action='photo_publish' then
   if not player.public_profile or player.guardian_consent_at is null or not coalesce((payload->>'permission_confirmed')::boolean,false) then raise exception 'Confirm player/guardian permission for this photo'; end if;
   if not exists(select 1 from public.profiles where id=player.user_id and avatar_path is not null) then raise exception 'This player has not uploaded a profile photo'; end if;
   update public.sports_players set photo_path=(select avatar_path from public.profiles where id=player.user_id) where id=player.id and (select avatar_path from public.profiles where id=player.user_id) like player.user_id::text||'/%' returning to_jsonb(sports_players.*) into result;
   if result is null then raise exception 'Invalid account photo'; end if;
  else
   update public.sports_players set photo_path=null where id=player.id returning to_jsonb(sports_players.*) into result;
  end if;
  entity:=player.id;entity_type:='player';
 elsif action in ('fixture_create','fixture_update') then
  select * into strict home from public.sports_teams where id=(payload->>'home_team_id')::uuid;
  select * into strict away from public.sports_teams where id=(payload->>'away_team_id')::uuid;
  if home.id=away.id or home.sport<>away.sport or home.age_group<>away.age_group or home.season_year<>away.season_year or home.gender is distinct from away.gender then raise exception 'Select different teams in the same sport, season and group'; end if;
  if not sports_private.can_edit(actor,home.school_id,home.id) and not sports_private.can_edit(actor,away.school_id,away.id) then raise exception 'Team access required' using errcode='42501'; end if;
  if action='fixture_create' then
   insert into public.sports_matches(home_team_id,away_team_id,starts_at,venue) values(home.id,away.id,(payload->>'starts_at')::timestamptz,left(payload->>'venue',160)) returning id,to_jsonb(sports_matches.*) into entity,result;
  else
   select * into strict match from public.sports_matches where id=(payload->>'id')::uuid for update;
   if payload->>'revision' is null or match.status<>'scheduled' or match.revision<>(payload->>'revision')::int then raise exception 'Fixture changed. Refresh before editing.' using errcode='40001'; end if;
   if match.home_team_id<>home.id or match.away_team_id<>away.id then raise exception 'Teams cannot be replaced when rescheduling'; end if;
   before_row:=to_jsonb(match);
   update public.sports_matches set starts_at=(payload->>'starts_at')::timestamptz,venue=left(payload->>'venue',160),revision=revision+1 where id=match.id returning id,to_jsonb(sports_matches.*) into entity,result;
  end if;
  entity_type:='match';
 elsif action in ('result_submit','result_confirm','event_add') then
  select * into strict match from public.sports_matches where id=(payload->>'id')::uuid for update;
  if payload->>'revision' is null or match.revision<>(payload->>'revision')::int then raise exception 'Match changed. Refresh before saving.' using errcode='40001'; end if;
  select * into strict home from public.sports_teams where id=match.home_team_id;
  select * into strict away from public.sports_teams where id=match.away_team_id;
  before_row:=to_jsonb(match);entity_type:='match';
  if action='result_confirm' then
   if match.status<>'pending_confirmation' or match.submitted_by=actor then raise exception 'Another administrator must confirm a submitted result' using errcode='42501'; end if;
   side:=case when match.submitted_team_id=home.id then away.id else home.id end;
   select * into strict team from public.sports_teams where id=side;
   if not super and not sports_private.can_edit(actor,team.school_id,team.id) then raise exception 'Opposing school confirmation required' using errcode='42501'; end if;
   update public.sports_matches set status='official',confirmed_by=actor,confirmed_at=now(),revision=revision+1 where id=match.id returning id,to_jsonb(sports_matches.*) into entity,result;
  elsif action='result_submit' then
   if match.status='official' then raise exception 'Confirmed results cannot be overwritten'; end if;
   side:=(payload->>'team_id')::uuid;
   if side not in (home.id,away.id) then raise exception 'Choose the school submitting this result'; end if;
   select * into strict team from public.sports_teams where id=side;
   if not sports_private.can_edit(actor,team.school_id,team.id) then raise exception 'Team access required' using errcode='42501'; end if;
   if (payload->>'home_score')::int not between 0 and 300 or (payload->>'away_score')::int not between 0 and 300 then raise exception 'Scores must be between 0 and 300'; end if;
   if nullif(payload->>'player_of_match_id','') is not null and not exists(select 1 from public.sports_team_players where player_id=(payload->>'player_of_match_id')::uuid and team_id in (home.id,away.id)) then raise exception 'Player of the Match must be on a match roster'; end if;
   update public.sports_matches set home_score=(payload->>'home_score')::int,away_score=(payload->>'away_score')::int,player_of_match_id=nullif(payload->>'player_of_match_id','')::uuid,status='pending_confirmation',submitted_by=actor,submitted_team_id=side,submitted_at=now(),confirmed_by=null,confirmed_at=null,revision=revision+1 where id=match.id returning id,to_jsonb(sports_matches.*) into entity,result;
  else
   if match.status='official' then raise exception 'Confirmed match events are locked'; end if;
   select * into strict team from public.sports_teams where id=(payload->>'team_id')::uuid;
   if team.id not in (home.id,away.id) or not sports_private.can_edit(actor,team.school_id,team.id) then raise exception 'Match team access required' using errcode='42501'; end if;
   if not exists(select 1 from public.sports_team_players where player_id=(payload->>'player_id')::uuid and team_id=team.id) then raise exception 'Select a player on this team'; end if;
   insert into public.sports_match_events(match_id,team_id,player_id,event_type,minute,created_by) values(match.id,team.id,(payload->>'player_id')::uuid,payload->>'event_type',nullif(payload->>'minute','')::int,actor) returning id,to_jsonb(sports_match_events.*) into entity,result;
   update public.sports_matches set revision=revision+1 where id=match.id;
   entity_type:='event';
  end if;
 elsif action='grant' then
  if not super then raise exception 'Super admin required' using errcode='42501'; end if;
  if payload->>'role' not in ('super_admin','school_admin','coach') then raise exception 'Unsupported role'; end if;
  if payload->>'role'<>'super_admin' and nullif(payload->>'school_id','') is null then raise exception 'School is required'; end if;
  if payload->>'role'='coach' then
   select * into strict team from public.sports_teams where id=(payload->>'team_id')::uuid;
   if team.school_id<>(payload->>'school_id')::uuid then raise exception 'Team must belong to assigned school'; end if;
  end if;
  insert into public.sports_admin_assignments(user_id,role,school_id,team_id) values((payload->>'user_id')::uuid,(payload->>'role')::public.sports_admin_role,case when payload->>'role'='super_admin' then null else (payload->>'school_id')::uuid end,case when payload->>'role'='coach' then (payload->>'team_id')::uuid else null end) returning id,to_jsonb(sports_admin_assignments.*) into entity,result;
  entity_type:='assignment';
 elsif action='revoke' then
  if not super then raise exception 'Super admin required' using errcode='42501'; end if;
  select * into strict assignment from public.sports_admin_assignments where id=(payload->>'id')::uuid for update;
  if assignment.user_id=actor then raise exception 'You cannot revoke your own access'; end if;
  before_row:=to_jsonb(assignment);
  update public.sports_admin_assignments set active=false where id=assignment.id returning id,to_jsonb(sports_admin_assignments.*) into entity,result;
  entity_type:='assignment';
 else raise exception 'Unknown admin action';
 end if;
 insert into public.sports_audit_log(actor_user_id,action,entity_type,entity_id,before_data,after_data) values(actor,action,entity_type,entity,before_row,result);
 return jsonb_build_object('saved',true,'id',entity);
end $$;
revoke all on function sports_private.admin_mutate(text,jsonb) from public,anon;
grant usage on schema sports_private to authenticated;
grant execute on function sports_private.admin_mutate(text,jsonb) to authenticated;
create or replace function public.sports_admin_mutate(action text,payload jsonb) returns jsonb language sql security invoker set search_path='' as $$ select sports_private.admin_mutate(action,payload) $$;
revoke all on function public.sports_admin_mutate(text,jsonb) from public,anon;
grant execute on function public.sports_admin_mutate(text,jsonb) to authenticated;
-- Existing SELECT policies also use this helper. A coach has no whole-school
-- permission, and the legacy match_official role does not grant global access.
create or replace function public.can_manage_sports(p_school_id uuid,p_team_id uuid default null) returns boolean language sql stable security invoker set search_path='' as $$
 select exists(select 1 from public.sports_admin_assignments a where a.user_id=(select auth.uid()) and a.active and (a.role='super_admin' or (a.role='school_admin' and a.school_id=p_school_id) or (a.role='coach' and p_team_id is not null and a.school_id=p_school_id and a.team_id=p_team_id)))
$$;

-- Production access hardening.
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
-- Match UAT school-link upserts; abort rather than remove any duplicate memberships.
create unique index if not exists school_memberships_user_school_unique on public.school_memberships(user_id,school_id);

