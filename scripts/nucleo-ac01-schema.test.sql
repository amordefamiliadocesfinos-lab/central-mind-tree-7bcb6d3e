-- Ensaio SOMENTE em PostgreSQL descartável (CI). Nunca executar como substituto de migration produtiva.
DO $$
DECLARE
 p_count int;
BEGIN
 IF to_regclass('public.nucleo_specialist_contributions') IS NULL THEN
   RAISE EXCEPTION 'AC01: tabela ausente';
 END IF;
 IF NOT EXISTS (SELECT 1 FROM pg_class WHERE oid='public.nucleo_specialist_contributions'::regclass AND relrowsecurity) THEN
   RAISE EXCEPTION 'AC01: RLS desligada';
 END IF;
 IF NOT has_table_privilege('authenticated','public.nucleo_specialist_contributions','SELECT')
 OR NOT has_table_privilege('authenticated','public.nucleo_specialist_contributions','INSERT') THEN
   RAISE EXCEPTION 'AC01: SELECT/INSERT não concedidos';
 END IF;
 IF has_table_privilege('authenticated','public.nucleo_specialist_contributions','UPDATE')
 OR has_table_privilege('authenticated','public.nucleo_specialist_contributions','DELETE')
 OR has_table_privilege('anon','public.nucleo_specialist_contributions','SELECT')
 OR has_table_privilege('anon','public.nucleo_specialist_contributions','INSERT') THEN
   RAISE EXCEPTION 'AC01: privilégios indevidos';
 END IF;
 SELECT count(*) INTO p_count FROM pg_policies
 WHERE schemaname='public' AND tablename='nucleo_specialist_contributions'
   AND policyname IN ('nucleo_ac01_read','nucleo_ac01_insert')
   AND cmd IN ('SELECT','INSERT');
 IF p_count<>2 THEN RAISE EXCEPTION 'AC01: políticas esperadas ausentes'; END IF;
 IF EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='nucleo_specialist_contributions'
  AND cmd IN ('UPDATE','DELETE','ALL')) THEN
   RAISE EXCEPTION 'AC01: política mutável encontrada';
 END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_trigger
 WHERE tgrelid='public.nucleo_specialist_contributions'::regclass
   AND tgname='nucleo_ac01_insert_guard' AND NOT tgisinternal) THEN
   RAISE EXCEPTION 'AC01: trigger de imutabilidade/linhagem ausente';
 END IF;
 RAISE NOTICE 'AC01 schema, policies, grants and guard PASS (disposable only)';
END $$;
