-- Applied to production as migration: optimize_rls_and_foreign_key_indexes
-- Avoid row-by-row auth.uid() evaluation and cover foreign keys.

drop policy if exists "users read own profile" on public.profiles;
create policy "users read own profile" on public.profiles for select to authenticated using ((select auth.uid()) = id);
drop policy if exists "users update own profile" on public.profiles;
create policy "users update own profile" on public.profiles for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

drop policy if exists "users create own memberships" on public.school_memberships;
create policy "users create own memberships" on public.school_memberships for insert to authenticated with check ((select auth.uid()) = user_id);
drop policy if exists "users read own memberships" on public.school_memberships;
create policy "users read own memberships" on public.school_memberships for select to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "users create own commitments" on public.commitments;
create policy "users create own commitments" on public.commitments for insert to authenticated with check ((select auth.uid()) = user_id);
drop policy if exists "users read own commitments" on public.commitments;
create policy "users read own commitments" on public.commitments for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists "users update own commitments" on public.commitments;
create policy "users update own commitments" on public.commitments for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

drop policy if exists "users manage own invites" on public.invites;
create policy "users manage own invites" on public.invites for all to authenticated using ((select auth.uid()) = inviter_user_id) with check ((select auth.uid()) = inviter_user_id);

drop policy if exists "users read own ledger" on public.ledger_transactions;
create policy "users read own ledger" on public.ledger_transactions for select to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "users read own payment attempts" on public.payment_attempts;
create policy "users read own payment attempts" on public.payment_attempts for select to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "users read own votes" on public.project_votes;
create policy "users read own votes" on public.project_votes for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists "members vote on school projects" on public.project_votes;
create policy "members vote on school projects" on public.project_votes for insert to authenticated
with check ((select auth.uid()) = user_id and exists (
  select 1 from public.projects p join public.school_memberships sm on sm.school_id = p.school_id
  where p.id = project_id and sm.user_id = (select auth.uid())
));
drop policy if exists "users remove own votes" on public.project_votes;
create policy "users remove own votes" on public.project_votes for delete to authenticated using ((select auth.uid()) = user_id);

create index if not exists school_memberships_school_idx on public.school_memberships(school_id);
create index if not exists project_updates_project_idx on public.project_updates(project_id);
create index if not exists project_votes_user_idx on public.project_votes(user_id);
create index if not exists payment_attempts_user_idx on public.payment_attempts(user_id);
create index if not exists payment_attempts_commitment_idx on public.payment_attempts(commitment_id);
create index if not exists ledger_user_idx on public.ledger_transactions(user_id);
create index if not exists ledger_project_idx on public.ledger_transactions(project_id);
create index if not exists ledger_commitment_idx on public.ledger_transactions(commitment_id);
create index if not exists invites_inviter_idx on public.invites(inviter_user_id);
create index if not exists invites_school_idx on public.invites(school_id);
create index if not exists invites_accepted_by_idx on public.invites(accepted_by);
create index if not exists expenditures_school_idx on public.expenditures(school_id);
create index if not exists expenditures_project_idx on public.expenditures(project_id);
create index if not exists documents_school_idx on public.documents(school_id);
create index if not exists documents_project_idx on public.documents(project_id);
create index if not exists documents_expenditure_idx on public.documents(expenditure_id);

drop index if exists public.ledger_school_occurred_idx;
