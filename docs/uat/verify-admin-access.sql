-- Execute only in UAT. All temporary role assignments and writes are rolled back.
begin;
create temp table access_test_context as
select (select id from public.profiles where id not in (select user_id from public.sports_admin_assignments) limit 1) actor,
       t.id team, t.school_id school,
       (select id from public.sports_teams where school_id<>t.school_id limit 1) other_team,
       (select school_id from public.sports_teams where school_id<>t.school_id limit 1) other_school
from public.sports_teams t limit 1;
grant select on access_test_context to authenticated;
select set_config('request.jwt.claim.sub',actor::text,true) from access_test_context;
set local role authenticated;
do $$ begin
  if exists(select 1 from public.platform_admins) then raise exception 'Ordinary account can see a platform role'; end if;
  begin
    perform public.sports_admin_mutate('grant','{}');
    raise exception 'Ordinary user mutation was allowed';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
insert into public.sports_admin_assignments(user_id,role,school_id,team_id)
select actor,'coach',school,team from access_test_context;
set local role authenticated;
do $$ declare c record; begin
  select * into c from access_test_context;
  if not public.can_manage_sports(c.school,c.team) then raise exception 'Assigned coach denied'; end if;
  if public.can_manage_sports(c.other_school,c.other_team) or public.can_manage_sports(c.school,null) then raise exception 'Coach scope escaped'; end if;
  begin
    perform public.sports_admin_mutate('grant',jsonb_build_object('user_id',c.actor,'role','super_admin'));
    raise exception 'Coach escalated own role';
  exception when insufficient_privilege then null; end;
  begin
    perform public.sports_admin_mutate('player_create',jsonb_build_object('team_id',c.other_team,'first_name','Denied','last_name','Test'));
    raise exception 'Coach edited another school';
  exception when insufficient_privilege then null; end;
  perform public.sports_admin_mutate('player_create',jsonb_build_object('team_id',c.team,'first_name','Rollback','last_name','Test'));
end $$;
reset role;
update public.sports_admin_assignments set active=false where user_id=(select actor from access_test_context);
insert into public.sports_admin_assignments(user_id,role,school_id)
select actor,'school_admin',school from access_test_context;
set local role authenticated;
do $$ declare c record; begin
  select * into c from access_test_context;
  if not public.can_manage_sports(c.school,null) or public.can_manage_sports(c.other_school,c.other_team) then raise exception 'Manager scope incorrect'; end if;
  perform public.sports_admin_mutate('team_create',jsonb_build_object('school_id',c.school,'name','Rollback test team','age_group','U13','sport','football','gender','mixed','season_year',2026));
  begin
    perform public.sports_admin_mutate('team_create',jsonb_build_object('school_id',c.other_school,'name','Denied test team','age_group','U13','sport','football','gender','mixed','season_year',2026));
    raise exception 'Manager edited another school';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
update public.sports_admin_assignments set active=false where user_id=(select actor from access_test_context);
set local role authenticated;
do $$ begin
  begin
    perform public.sports_admin_mutate('grant','{}');
    raise exception 'Revoked user mutation allowed';
  exception when insufficient_privilege then null; end;
end $$;
rollback;
select 'PASS: ordinary and revoked users denied; coach and manager scopes enforced; own-scope writes work; self-promotion denied; test writes rolled back' as result;
