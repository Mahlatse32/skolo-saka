alter table public.profiles
  add column if not exists first_name text,
  add column if not exists last_name text,
  add column if not exists email text;

alter table public.school_memberships
  add column if not exists grade_left smallint;

alter table public.school_memberships
  drop constraint if exists school_memberships_grade_left_check;

alter table public.school_memberships
  add constraint school_memberships_grade_left_check
  check (grade_left is null or grade_left between 1 and 12);

comment on column public.profiles.first_name is 'Optional first name added after registration.';
comment on column public.profiles.last_name is 'Optional surname added after registration.';
comment on column public.profiles.email is 'Optional contact email added after registration.';
comment on column public.school_memberships.grade_left is 'Grade the user was in when they left this school, 1 through 12.';
