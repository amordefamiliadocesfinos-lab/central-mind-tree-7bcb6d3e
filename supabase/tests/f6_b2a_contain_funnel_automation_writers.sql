-- F6-B.2a — validação transacional/read-only após aplicação da migration.
-- Não cria dados de negócio. Pode ser executado após a migration e termina em ROLLBACK.
BEGIN;

DO $test$
DECLARE
  v_def text;
  v_active_legacy int;
  v_preserved_legacy int;
BEGIN
  SELECT pg_get_functiondef('public.apply_funnel_automations()'::regprocedure)
    INTO v_def;

  IF v_def ILIKE '%SET next_action_text%'
     OR v_def ILIKE '%next_action_date =%'
     OR v_def ILIKE '%next_contact_date =%'
     OR v_def ILIKE '%INSERT INTO public.tasks%'
     OR v_def ILIKE '%UPDATE public.tasks%'
     OR v_def ILIKE '%SET funnel_status =%' THEN
    RAISE EXCEPTION 'F6-B.2a falhou: writer operacional ainda presente em apply_funnel_automations()';
  END IF;

  IF v_def NOT ILIKE '%operational_write_blocked%' THEN
    RAISE EXCEPTION 'F6-B.2a falhou: sinal de contenção não encontrado na função';
  END IF;

  SELECT count(*)
    INTO v_preserved_legacy
    FROM public.automation_rules
   WHERE id IN (
     'e3d3808a-e980-486a-8d0a-72eb5e8a3b74'::uuid,
     '23de88ba-6aa4-41ab-8a87-eba61d3548f5'::uuid
   );

  IF v_preserved_legacy <> 2 THEN
    RAISE EXCEPTION 'F6-B.2a falhou: regras legadas não foram preservadas';
  END IF;

  SELECT count(*)
    INTO v_active_legacy
    FROM public.automation_rules
   WHERE id IN (
     'e3d3808a-e980-486a-8d0a-72eb5e8a3b74'::uuid,
     '23de88ba-6aa4-41ab-8a87-eba61d3548f5'::uuid
   )
     AND is_active = true;

  IF v_active_legacy <> 0 THEN
    RAISE EXCEPTION 'F6-B.2a falhou: regra legada continua ativa';
  END IF;

  IF NOT EXISTS (
    SELECT 1
      FROM pg_trigger t
      JOIN pg_class c ON c.oid = t.tgrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE NOT t.tgisinternal
       AND n.nspname = 'public'
       AND c.relname = 'contacts'
       AND t.tgname = 'trg_apply_funnel_automations'
  ) THEN
    RAISE EXCEPTION 'F6-B.2a falhou: trigger esperado não existe';
  END IF;
END
$test$;

-- Evidências legíveis para revisão pós-migration.
SELECT id, name, action_type, is_active, last_triggered_at
  FROM public.automation_rules
 WHERE id IN (
   'e3d3808a-e980-486a-8d0a-72eb5e8a3b74'::uuid,
   '23de88ba-6aa4-41ab-8a87-eba61d3548f5'::uuid
 )
 ORDER BY name;

SELECT pg_get_triggerdef(t.oid, true) AS trigger_definition
  FROM pg_trigger t
  JOIN pg_class c ON c.oid = t.tgrelid
  JOIN pg_namespace n ON n.oid = c.relnamespace
 WHERE NOT t.tgisinternal
   AND n.nspname = 'public'
   AND c.relname = 'contacts'
   AND t.tgname = 'trg_apply_funnel_automations';

ROLLBACK;
