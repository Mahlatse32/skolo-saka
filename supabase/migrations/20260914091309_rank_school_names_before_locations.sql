-- Rank the full matching set before pagination. Public school data only;
-- SECURITY INVOKER preserves the caller's existing schools SELECT policies.
create or replace function public.search_school_directory(
  p_query text default '', p_area text default '',
  p_province text default null, p_level text default null,
  p_verified_only boolean default false, p_page integer default 0
) returns jsonb
language plpgsql stable security invoker set search_path = public
as $$
declare
  term text := lower(trim(regexp_replace(regexp_replace(coalesce(p_query,''), '[,%()_*]', ' ', 'g'), '\s+', ' ', 'g')));
  area text := trim(regexp_replace(regexp_replace(coalesce(p_area,''), '[,%()_*]', ' ', 'g'), '\s+', ' ', 'g'));
  tokens text[];
  result jsonb;
begin
  if p_page is null or p_page < 0 or p_page > 10000 or length(term) > 200 or length(area) > 200 then
    raise exception 'Invalid search parameters' using errcode = '22023';
  end if;
  tokens := (string_to_array(term, ' '))[1:6];
  with matched as (
    select s.id,s.name,s.level,s.province,s.municipality,s.town,s.verified,
      case
        when term = '' then 0
        when lower(trim(s.name)) = term then 0
        when lower(s.name) like term || '%' then 1
        when lower(s.name) like '%' || term || '%' then 2
        when not exists (select 1 from unnest(tokens) t where s.name not ilike '%' || t || '%') then 3
        else 4
      end as relevance
    from public.schools s
    where (p_province is null or s.province = p_province)
      and (p_level is null or s.level::text = p_level)
      and (not coalesce(p_verified_only,false) or s.verified)
      and (area = '' or s.town ilike '%' || area || '%' or s.municipality ilike '%' || area || '%')
      and (term = '' or not exists (
        select 1 from unnest(tokens) t
        where not (s.name ilike '%' || t || '%'
          or coalesce(s.town,'') ilike '%' || t || '%'
          or coalesce(s.municipality,'') ilike '%' || t || '%')
      ))
  ), paged as (
    select * from matched order by relevance,lower(name),id limit 30 offset p_page * 30
  )
  select jsonb_build_object(
    'total',(select count(*) from matched),
    'items',coalesce((select jsonb_agg(to_jsonb(p) - 'relevance' order by p.relevance,lower(p.name),p.id) from paged p),'[]'::jsonb)
  ) into result;
  return result;
end;
$$;
revoke all on function public.search_school_directory(text,text,text,text,boolean,integer) from public;
grant execute on function public.search_school_directory(text,text,text,text,boolean,integer) to anon,authenticated,service_role;
