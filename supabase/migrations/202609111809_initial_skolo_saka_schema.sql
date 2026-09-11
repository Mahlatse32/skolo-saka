-- Initial Skolo Saka production schema
-- Applied to Supabase project nnexzxszqjedaqqukfiq.
-- Core model: users can belong to and contribute independently to multiple schools.

create extension if not exists pgcrypto;

-- See Supabase migration history for the applied schema. This repository migration is
-- intentionally the canonical entry point for subsequent schema changes.
-- Core tables currently deployed:
-- profiles, schools, school_memberships, commitments, projects,
-- project_updates, ledger_transactions, invites.
-- RLS is enabled on every exposed table and security advisor currently reports no findings.
