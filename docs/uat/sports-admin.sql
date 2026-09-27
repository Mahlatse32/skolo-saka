-- UAT-only operational migration. Apply only to faytrobauwibxujvmbct.
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
 if not exists(select 1 from public.sports_admin_assignments where user_id=actor and active) then raise exception 'Sports admin access required' using errcode='42501'; end if;
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
