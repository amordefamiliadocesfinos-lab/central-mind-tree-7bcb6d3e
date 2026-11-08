-- F13 TESTES MT structural/security postcheck. Read-only.
WITH gen_fn AS (
  SELECT p.oid,p.prosecdef,array_to_string(p.proconfig,',') AS proconfig
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid=p.pronamespace
  WHERE n.nspname='public'
    AND p.proname='health_f13_generate_longitudinal_review'
    AND pg_get_function_identity_arguments(p.oid)='p_athlete_id uuid, p_as_of_date date, p_window_days integer'
), outcome_fn AS (
  SELECT p.oid,p.prosecdef,array_to_string(p.proconfig,',') AS proconfig
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid=p.pronamespace
  WHERE n.nspname='public'
    AND p.proname='health_f13_record_review_outcome'
    AND pg_get_function_identity_arguments(p.oid)='p_review_run_id uuid, p_outcome_code text, p_target_domains text[], p_notes text'
), fk AS (
  SELECT c.conname,c.conrelid,c.conkey
  FROM pg_constraint c
  WHERE c.contype='f'
    AND c.conrelid::regclass::text IN (
      'health_longitudinal_review_runs',
      'health_longitudinal_review_outcomes'
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
  to_regclass('public.health_longitudinal_review_runs') IS NOT NULL
  AND to_regclass('public.health_longitudinal_review_outcomes') IS NOT NULL
  AND (SELECT count(*) FROM gen_fn)=1
  AND (SELECT count(*) FROM outcome_fn)=1
  AND (SELECT bool_and(prosecdef) FROM gen_fn)
  AND (SELECT bool_and(prosecdef) FROM outcome_fn)
  AND (SELECT bool_and(proconfig LIKE '%search_path=""%') FROM gen_fn)
  AND (SELECT bool_and(proconfig LIKE '%search_path=""%') FROM outcome_fn)
  AND (
    SELECT bool_and(c.relrowsecurity)
    FROM pg_class c
    JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public'
      AND c.relname IN (
        'health_longitudinal_review_runs',
        'health_longitudinal_review_outcomes'
      )
  )
  AND has_table_privilege('authenticated','public.health_longitudinal_review_runs','SELECT')
  AND has_table_privilege('authenticated','public.health_longitudinal_review_outcomes','SELECT')
  AND NOT has_table_privilege('authenticated','public.health_longitudinal_review_runs','INSERT')
  AND NOT has_table_privilege('authenticated','public.health_longitudinal_review_runs','UPDATE')
  AND NOT has_table_privilege('authenticated','public.health_longitudinal_review_runs','DELETE')
  AND NOT has_table_privilege('authenticated','public.health_longitudinal_review_outcomes','INSERT')
  AND NOT has_table_privilege('authenticated','public.health_longitudinal_review_outcomes','UPDATE')
  AND NOT has_table_privilege('authenticated','public.health_longitudinal_review_outcomes','DELETE')
  AND NOT has_table_privilege('anon','public.health_longitudinal_review_runs','SELECT')
  AND NOT has_table_privilege('anon','public.health_longitudinal_review_outcomes','SELECT')
  AND NOT has_function_privilege('anon',(SELECT oid FROM gen_fn),'EXECUTE')
  AND NOT has_function_privilege('anon',(SELECT oid FROM outcome_fn),'EXECUTE')
  AND has_function_privilege('authenticated',(SELECT oid FROM gen_fn),'EXECUTE')
  AND has_function_privilege('authenticated',(SELECT oid FROM outcome_fn),'EXECUTE')
  AND (SELECT n FROM fk_missing_index)=0
THEN 'F13_TESTES_MT_POSTCHECK_PASS'
ELSE 'F13_TESTES_MT_POSTCHECK_FAIL'
END AS result;
