-- CANDIDATE ONLY — DO NOT EXECUTE IN THE PRODUCTION CORE.
-- Deliberately outside supabase/migrations to avoid accidental application.
-- Preconditions: explicit dependency review, consent to revoke public anonymous
-- business access, real anon/legacy/scoped tests, and applied grant-foundation migration.
-- The six source tables were observed on the live Core with explicit
-- anon and authenticated CRUD grants and an overly permissive RLS policy.
-- **The real policy coverage of indirect views/RPCs/functions must be audited first.**
begin;

-- Phase A: remove explicit anonymous business CRUD privileges.
-- Authenticated users retain their separate explicit grants in the source ACL.
revoke all privileges on table
  public.contacts,
  public.financial_accounts,
  public.financial_movements,
  public.ai_insights,
  public.ai_actions,
  public.tasks
from anon;

-- Phase B: deny scoped identities on business tables even when their old
-- permissive policies say USING true.
-- The helper comes from 20261108190000_panel_admin_user_module_grants.sql.
create policy scoped_deny_contacts on public.contacts as restrictive
  for all to authenticated
  using (not (select app_private_access.is_scoped_identity()))
  with check (not (select app_private_access.is_scoped_identity()));

create policy scoped_deny_financial_accounts on public.financial_accounts as restrictive
  for all to authenticated
  using (not (select app_private_access.is_scoped_identity()))
  with check (not (select app_private_access.is_scoped_identity()));

create policy scoped_deny_financial_movements on public.financial_movements as restrictive
  for all to authenticated
  using (not (select app_private_access.is_scoped_identity()))
  with check (not (select app_private_access.is_scoped_identity()));

create policy scoped_deny_ai_insights on public.ai_insights as restrictive
  for all to authenticated
  using (not (select app_private_access.is_scoped_identity()))
  with check (not (select app_private_access.is_scoped_identity()));

create policy scoped_deny_ai_actions on public.ai_actions as restrictive
  for all to authenticated
  using (not (select app_private_access.is_scoped_identity()))
  with check (not (select app_private_access.is_scoped_identity()));

create policy scoped_deny_tasks on public.tasks as restrictive
  for all to authenticated
  using (not (select app_private_access.is_scoped_identity()))
  with check (not (select app_private_access.is_scoped_identity()));

-- The actual rollout will require separate positive tests for authenticated
-- legacy operations and negative tests for anon/scoped identities.
-- This SQL is a *candidate* and not a complete coverage solution.
rollback;
