-- F11 TESTES MT structural/security postcheck. Read-only.
WITH fn AS (
  SELECT p.oid,p.prosecdef,array_to_string(p.proconfig,',') AS proconfig
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid=p.pronamespace
  WHERE n.nspname='public'
    AND p.proname='health_f11_evaluate_integrated_decision'
    AND pg_get_function_identity_arguments(p.oid)='p_athlete_id uuid, p_as_of_date date, p_window_days integer'
), fk AS (
  SELECT c.conname,c.conrelid,c.conkey
  FROM pg_constraint c
  WHERE c.contype='f'
    AND c.conrelid::regclass::text IN (
      'health_integrated_decision_runs',
      'health_integrated_decisions'
    )
), fk_missing_index AS (
  SELECT count(*) AS n
  FROM fk
  WHERE NOT EXISTS (
    SELECT 1
    FROM pg_index i
    WHERE i.indrelid=fk.conrelid
      AND i.indisvalid
      AND (i.indkey::smallint[])[0:cardinality(fk.conkey)-1]=fk.conkey
  )
)
SELECT CASE WHEN
  to_regclass('public.health_integrated_decision_runs') IS NOT NULL
  AND to_regclass('public.health_integrated_decisions') IS NOT NULL
  AND (SELECT count(*) FROM fn)=1
  AND (SELECT bool_and(prosecdef) FROM fn)
  AND (SELECT bool_and(proconfig LIKE '%search_path=""%') FROM fn)
  AND (
    SELECT bool_and(c.relrowsecurity)
    FROM pg_class c
    JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public'
      AND c.relname IN ('health_integrated_decision_runs','health_integrated_decisions')
  )
  AND has_table_privilege('authenticated','public.health_integrated_decision_runs','SELECT')
  AND has_table_privilege('authenticated','public.health_integrated_decisions','SELECT')
  AND NOT has_table_privilege('authenticated','public.health_integrated_decision_runs','INSERT')
  AND NOT has_table_privilege('authenticated','public.health_integrated_decisions','INSERT')
  AND NOT has_table_privilege('anon','public.health_integrated_decision_runs','SELECT')
  AND NOT has_table_privilege('anon','public.health_integrated_decisions','SELECT')
  AND NOT has_function_privilege('anon',(SELECT oid FROM fn),'EXECUTE')
  AND has_function_privilege('authenticated',(SELECT oid FROM fn),'EXECUTE')
  AND (SELECT n FROM fk_missing_index)=0
THEN 'F11_TESTES_MT_POSTCHECK_PASS'
ELSE 'F11_TESTES_MT_POSTCHECK_FAIL'
END AS result;
