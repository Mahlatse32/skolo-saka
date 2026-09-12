drop policy if exists "users update own memberships" on public.school_memberships;
create policy "users update own memberships"
on public.school_memberships
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "users delete own memberships" on public.school_memberships;
create policy "users delete own memberships"
on public.school_memberships
for delete
to authenticated
using ((select auth.uid()) = user_id);
