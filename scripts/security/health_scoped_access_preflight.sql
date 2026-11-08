-- READ ONLY / PROOF CHECK — run on the official Core in a privileged read-only SQL session.
-- Never use these aggregate results alone as proof of effective external access.
-- Observed 2026-11-08: public tables 219, SELECT anon 113, broad true SELECT policies 72.
-- Live results are authoritative; do not hardcode these counts in decisions.
select count(*) as public_tables,
  count(*) filter (where not rowsecurity) as rls_disabled,
  count(*) filter (where has_table_privilege('anon', format('%I.%I', schemaname, tablename),'SELECT')) as anon_select_grants,
  count(*) filter (where has_table_privilege('authenticated', format('%I.%I', schemaname, tablename),'SELECT')) as authenticated_select_grants
from pg_tables where schemaname='public';

-- Candidates for anonymous SELECT exposure (must verify API exposure and actual query).
select distinct p.tablename, p.policyname, p.cmd, p.roles, p.qual
from pg_policies p
join pg_tables t on t.schemaname=p.schemaname and t.tablename=p.tablename
where p.schemaname='public'
  and ('public'=any(p.roles) or 'anon'=any(p.roles))
  and p.cmd in ('ALL','SELECT')
  and coalesce(p.qual,'') in ('true','(true)')
  and has_table_privilege('anon',format('%I.%I',t.schemaname,t.tablename),'SELECT')
order by p.tablename,p.policyname;

-- All tables with RLS off (do not automatically ENABLE in production without dependency test).
select schemaname,tablename
from pg_tables
where schemaname='public' and not rowsecurity
order by tablename;

-- The table-level inventory is NOT sufficient: inspect views (security_invoker),
-- RPCs (SECURITY DEFINER), exposed schemas, Storage buckets/policies, realtime,
-- and any server-side service_role proxy endpoints before activating external users.
select schemaname,viewname,definition
from pg_views
where schemaname='public'
order by viewname;

-- The following final checks require a real external test JWT, separate from this script:
-- anon token -> CRM/Financeiro SELECT denied;
-- scoped Saúde JWT -> CRM/Financeiro/Operations denied; same person's health allowed;
-- scoped Saúde JWT -> other athlete denied;
-- post-revocation token -> sensitive operation denied;
-- existing legitimate administrator and operator access preserved.
