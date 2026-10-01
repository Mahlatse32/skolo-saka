-- Existing phone accounts verify by SMS or their saved recovery email and
-- choose a password. Old PIN-derived passwords must not remain an Auth bypass.
update auth.users
set encrypted_password = '', updated_at = now()
where phone is not null
  and coalesce(raw_app_meta_data->>'credential_version', '') <> 'password_v2'
  and coalesce(encrypted_password, '') <> '';

create or replace function public.password_credential_ready()
returns boolean
language sql stable
set search_path = ''
as $$
  select coalesce(auth.jwt()->'app_metadata'->>'credential_version', '') = 'password_v2';
$$;
revoke all on function public.password_credential_ready() from public;
grant execute on function public.password_credential_ready() to authenticated;

-- Restrictive policies supplement the existing ownership/role policies.
-- They also reject access tokens issued before password setup is complete.
do $$
declare relation_name text;
begin
  foreach relation_name in array array[
    'profiles', 'school_memberships', 'commitments', 'payment_attempts',
    'payment_instructions', 'payment_instruction_allocations', 'payments',
    'platform_admins', 'school_admins', 'sports_admin_assignments', 'invites'
  ] loop
    if to_regclass(format('public.%I', relation_name)) is not null then
      execute format('alter table public.%I enable row level security', relation_name);
      execute format('create policy password_credential_required on public.%I as restrictive for all to authenticated using ((select public.password_credential_ready())) with check ((select public.password_credential_ready()))', relation_name);
    end if;
  end loop;
end;
$$;
