alter table public.school_memberships
  drop constraint if exists school_memberships_grade_left_check;

alter table public.school_memberships
  add constraint school_memberships_grade_left_check
  check (grade_left is null or grade_left between 1 and 12);

alter table public.school_memberships
  drop constraint if exists school_memberships_graduation_year_check;

alter table public.school_memberships
  add constraint school_memberships_graduation_year_check
  check (graduation_year is null or graduation_year between 1900 and extract(year from now())::int + 1);

create index if not exists idx_school_memberships_school_year_grade
  on public.school_memberships (school_id, graduation_year, grade_left)
  where graduation_year is not null or grade_left is not null;
