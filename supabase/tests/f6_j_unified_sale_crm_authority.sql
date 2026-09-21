-- F6-J — validação estrutural read-only.
DO $$
DECLARE
  fn text;
BEGIN
  SELECT pg_get_functiondef(p.oid)
    INTO fn
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname = 'create_unified_sale';

  IF fn IS NULL THEN
    RAISE EXCEPTION 'F6-J: create_unified_sale não encontrada';
  END IF;

  IF fn ILIKE '%UPDATE public.contacts%funnel_status%' THEN
    RAISE EXCEPTION 'F6-J: create_unified_sale ainda altera funnel_status diretamente';
  END IF;

  IF fn ILIKE '%CRM-RES-021%' OR fn ILIKE '%sale_won%' THEN
    RAISE EXCEPTION 'F6-J: create_unified_sale ainda fabrica Resultado/histórico CRM diretamente';
  END IF;

  IF fn NOT ILIKE '%INSERT INTO public.orders%' OR fn NOT ILIKE '%INSERT INTO public.financial_entries%' THEN
    RAISE EXCEPTION 'F6-J: transação comercial/financeira esperada foi removida';
  END IF;
END
$$;
