-- PAINEL CENTRAL — Security gate snapshot (READ-ONLY)
-- Official project: xkskyutmtlhivvpfxkjg
-- Run in a read-only SQL console. No data writes, no RLS changes.
-- Exposure indicators are NOT proof of actual API exploitation.

-- 1. Summarize SQL grants / row security.
select count(*) as public_tables,
       count(*) filter (where not rowsecurity) as rls_disabled,
       count(*) filter (where has_table_privilege('anon',format('%I.%I',schemaname,tablename),'SELECT')) as sql_select_anon,
       count(*) filter (where has_table_privilege('authenticated',format('%I.%I',schemaname,tablename),'SELECT')) as sql_select_authenticated
from pg_tables where schemaname='public';

-- 2. Identify potential anonymous table SELECT through broad policies.
select p.tablename, p.policyname, p.cmd, p.roles::text as policy_roles, p.qual
from pg_policies p
join pg_tables t on t.schemaname=p.schemaname and t.tablename=p.tablename
where p.schemaname='public'
  and p.cmd in ('ALL','SELECT')
  and ('public'=any(p.roles) or 'anon'=any(p.roles))
  and coalesce(p.qual,'') in ('true','(true)')
  and has_table_privilege('anon',format('%I.%I',t.schemaname,t.tablename),'SELECT')
order by p.tablename,p.policyname;

-- 3. Inspect SECURITY DEFINER functions with SQL EXECUTE to anon.
-- Trigger-returning functions generally cannot be called as ordinary RPCs;
-- do not count them as equivalent to exposed callable endpoints.
select p.proname,pg_get_function_identity_arguments(p.oid) as arguments,
       p.prorettype::regtype::text as result_type,
       (p.prorettype='trigger'::regtype) as is_trigger,
       p.provolatile as volatility
from pg_proc p
join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and p.prosecdef
  and has_function_privilege('anon',p.oid,'EXECUTE')
order by is_trigger,p.proname;

-- 4. Surface actual bucket public flags, without reading object contents.
select name,public from storage.buckets order by name;

-- 5. Confirm foundations are NOT deployed until approved.
select table_name from information_schema.tables
where table_schema='public'
  and table_name in ('app_user_module_grants','app_user_module_grant_audit')
order by table_name;

-- Manual gates beyond catalog SQL:
-- - Verify Data API exposure, views, grants, and RPC execution using
--   real anon, legacy operator, restricted Health test and admin JWTs.
-- - Inspect client dependencies before any REVOKE anon.
-- - Negative tests: user scoped Health cannot query CRM, Financeiro,
--   other athlete media or business Edge Functions; Health owner can
--   access only authorized athlete; current business operations continue.
-- - Never infer PASS from code lint/TypeScript or metadata counts alone.
