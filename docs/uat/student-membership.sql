-- Applied only to skolo-saka-test (faytrobauwibxujvmbct).
-- Run separately from seed data so the enum value is committed first.
alter type public.membership_role add value if not exists 'student';
