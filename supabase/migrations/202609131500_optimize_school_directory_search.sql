create extension if not exists pg_trgm;

create index if not exists schools_name_trgm_idx
  on public.schools using gin (name gin_trgm_ops);

create index if not exists schools_town_trgm_idx
  on public.schools using gin (town gin_trgm_ops);

create index if not exists schools_municipality_trgm_idx
  on public.schools using gin (municipality gin_trgm_ops);
