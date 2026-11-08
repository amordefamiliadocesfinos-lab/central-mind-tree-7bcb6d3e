-- SECURITY DESIGN REVIEW ONLY (SELECT statements, no DDL execution).
-- Generates proposed restrictive policies for the current public schema.
-- DO NOT pipe the output into psql or make a migration automatically.
-- Every table requires a domain owner, legitimate consumer review and negative
-- auth / anon test before any policy or grant is changed.
WITH business_tables AS (
  SELECT t.schemaname,t.tablename,t.rowsecurity,
         has_table_privilege('anon',format('%I.%I',t.schemaname,t.tablename),'SELECT') AS anon_select,
         has_table_privilege('authenticated',format('%I.%I',t.schemaname,t.tablename),'SELECT') AS authenticated_select
  FROM pg_tables t
  WHERE t.schemaname='public'
    AND t.tablename NOT LIKE 'health\_%' ESCAPE '\'
    AND t.tablename NOT IN ('app_users','app_user_module_grants','app_user_module_grant_audit')
)
SELECT tablename,rowsecurity,anon_select,authenticated_select,
 CASE WHEN NOT rowsecurity
      THEN 'BLOCK: RLS disabled; review legacy access and ownership before enabling'
      WHEN anon_select
      THEN 'BLOCK: review anonymous dependency; scoped RLS alone cannot secure anon access'
      ELSE 'REVIEW: scoped guard candidate'
 END AS review_class,
 CASE WHEN rowsecurity AND authenticated_select
      THEN format(
       'CREATE POLICY %I ON %I.%I AS RESTRICTIVE FOR ALL TO authenticated USING (NOT (SELECT app_private_access.is_scoped_identity())) WITH CHECK (NOT (SELECT app_private_access.is_scoped_identity()));',
       'deny_scoped_' || substr(md5(tablename),1,12),schemaname,tablename)
 ELSE NULL END AS candidate_sql_only
FROM business_tables
ORDER BY anon_select DESC, tablename;

-- The broad public/anon policies and grants must be reconciled independently.
-- The output is informational; requires review of INSERT/UPDATE/DELETE,
-- views, trigger functions, security definer RPCs, Edge Functions and Storage.
