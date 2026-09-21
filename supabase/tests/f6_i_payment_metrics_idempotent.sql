-- F6-I — validação estrutural read-only.
DO $$
DECLARE
  fn text;
  recalc_fn text;
  trigger_def text;
BEGIN
  SELECT pg_get_functiondef(p.oid)
    INTO fn
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname = 'sync_contact_on_payment';

  SELECT pg_get_functiondef(p.oid)
    INTO recalc_fn
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname = 'recalculate_contact_payment_metrics';

  SELECT pg_get_triggerdef(t.oid)
    INTO trigger_def
  FROM pg_trigger t
  JOIN pg_class c ON c.oid = t.tgrelid
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE NOT t.tgisinternal
    AND n.nspname = 'public'
    AND c.relname = 'financial_movements'
    AND t.tgname = 'trg_sync_contact_on_payment';

  IF fn IS NULL OR recalc_fn IS NULL OR trigger_def IS NULL THEN
    RAISE EXCEPTION 'F6-I: função/trigger esperado ausente';
  END IF;

  IF fn ILIKE '%contact_history%' OR fn ILIKE '%payment_received%' THEN
    RAISE EXCEPTION 'F6-I: trigger financeiro ainda fabrica histórico CRM';
  END IF;

  IF recalc_fn ILIKE '%lifetime_value = COALESCE(lifetime_value%' OR recalc_fn ILIKE '%paid_orders_count = COALESCE(paid_orders_count%' THEN
    RAISE EXCEPTION 'F6-I: métricas ainda usam incremento não idempotente';
  END IF;

  IF recalc_fn NOT ILIKE '%sum(order_value)%' OR recalc_fn NOT ILIKE '%count(*)::integer%' THEN
    RAISE EXCEPTION 'F6-I: projeção idempotente das métricas não encontrada';
  END IF;

  IF trigger_def NOT ILIKE '%INSERT OR DELETE OR UPDATE%' AND trigger_def NOT ILIKE '%INSERT OR UPDATE OR DELETE%' THEN
    RAISE EXCEPTION 'F6-I: trigger não cobre inserção/edição/exclusão de movimentos';
  END IF;
END
$$;
