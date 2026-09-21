-- F6-H — validação estrutural, read-only.
-- Executar depois da migration no backend canônico.

DO $$
DECLARE
  fn text;
  forward_trigger_count integer;
  reverse_stage_trigger_count integer;
BEGIN
  SELECT pg_get_functiondef(p.oid)
    INTO fn
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname = 'auto_create_service_conversation';

  IF fn IS NULL THEN
    RAISE EXCEPTION 'F6-H: auto_create_service_conversation não encontrada';
  END IF;

  IF position('v_stage := NEW.funnel_status' in fn) = 0 THEN
    RAISE EXCEPTION 'F6-H: criação de conversa não usa funnel_status canônico diretamente';
  END IF;

  IF position('map_contact_to_conv_funnel' in fn) > 0 THEN
    RAISE EXCEPTION 'F6-H: criação de conversa ainda depende do mapa legado de funil';
  END IF;

  SELECT count(*)
    INTO forward_trigger_count
  FROM pg_trigger t
  JOIN pg_class c ON c.oid = t.tgrelid
  JOIN pg_namespace n ON n.oid = c.relnamespace
  JOIN pg_proc p ON p.oid = t.tgfoid
  WHERE NOT t.tgisinternal
    AND n.nspname = 'public'
    AND c.relname = 'contacts'
    AND p.proname = 'sync_funnel_contact_to_conversations';

  IF forward_trigger_count < 1 THEN
    RAISE EXCEPTION 'F6-H: trigger de espelho contacts -> service_conversations ausente';
  END IF;

  SELECT count(*)
    INTO reverse_stage_trigger_count
  FROM pg_trigger t
  JOIN pg_class c ON c.oid = t.tgrelid
  JOIN pg_namespace n ON n.oid = c.relnamespace
  JOIN pg_proc p ON p.oid = t.tgfoid
  WHERE NOT t.tgisinternal
    AND n.nspname = 'public'
    AND c.relname = 'service_conversations'
    AND pg_get_triggerdef(t.oid) ILIKE '%funnel%'
    AND pg_get_functiondef(p.oid) ILIKE '%contacts%funnel_status%';

  IF reverse_stage_trigger_count > 0 THEN
    RAISE EXCEPTION 'F6-H: ainda existe writer reverso service_conversations -> contacts.funnel_status';
  END IF;
END
$$;
