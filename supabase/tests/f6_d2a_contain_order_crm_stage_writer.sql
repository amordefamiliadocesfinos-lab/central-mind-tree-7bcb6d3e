-- F6-D.2a — validações focadas pós-migration
-- Executar somente em ambiente autorizado após aplicação da migration.
-- Todo cenário é transacional e termina em ROLLBACK.

BEGIN;

DO $do$
DECLARE
  v_function text;
BEGIN
  SELECT pg_get_functiondef(p.oid)
    INTO v_function
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public'
     AND p.proname = 'sync_contact_on_order_change';

  IF v_function IS NULL THEN
    RAISE EXCEPTION 'F6-D.2a: sync_contact_on_order_change() ausente';
  END IF;

  IF position('funnel_status' in v_function) > 0 THEN
    RAISE EXCEPTION 'F6-D.2a: writer concorrente funnel_status ainda presente';
  END IF;

  IF position('last_purchase_date' in v_function) = 0 THEN
    RAISE EXCEPTION 'F6-D.2a: last_purchase_date deixou de ser preservado';
  END IF;

  IF position('order_delivered' in v_function) = 0
     OR position('order_cancelled' in v_function) = 0 THEN
    RAISE EXCEPTION 'F6-D.2a: fatos operacionais de pedido não preservados';
  END IF;

  IF position('event_metadata' in v_function) = 0
     OR position('order_id' in v_function) = 0 THEN
    RAISE EXCEPTION 'F6-D.2a: identidade estruturada do pedido ausente';
  END IF;

  IF position('crm_next_action' in v_function) > 0
     OR position('applyCanonicalAttendanceResult' in v_function) > 0
     OR position('return_at' in v_function) > 0 THEN
    RAISE EXCEPTION 'F6-D.2a: efeito CRM fora do escopo detectado';
  END IF;
END
$do$;

-- Validação dinâmica sem criar pedido artificial:
-- usa um pedido existente vinculado a contato, altera somente dentro da transação
-- e verifica efeitos do trigger. ROLLBACK restaura pedido, contato e históricos.
DO $do$
DECLARE
  v_order public.orders%ROWTYPE;
  v_stage_before text;
  v_stage_after text;
  v_history_before bigint;
  v_history_after bigint;
  v_last_purchase date;
  v_metadata jsonb;
BEGIN
  SELECT o.*
    INTO v_order
    FROM public.orders o
   WHERE o.contact_id IS NOT NULL
   ORDER BY o.updated_at DESC NULLS LAST, o.created_at DESC
   LIMIT 1;

  IF v_order.id IS NULL THEN
    RAISE NOTICE 'F6-D.2a: cenário dinâmico ignorado — nenhum pedido vinculado disponível';
    RETURN;
  END IF;

  SELECT funnel_status INTO v_stage_before
    FROM public.contacts WHERE id = v_order.contact_id;

  SELECT count(*) INTO v_history_before
    FROM public.contact_history WHERE contact_id = v_order.contact_id;

  UPDATE public.orders
     SET status = CASE WHEN status = 'concluido' THEN 'entregue' ELSE 'concluido' END
   WHERE id = v_order.id;

  SELECT funnel_status, last_purchase_date
    INTO v_stage_after, v_last_purchase
    FROM public.contacts WHERE id = v_order.contact_id;

  IF v_stage_after IS DISTINCT FROM v_stage_before THEN
    RAISE EXCEPTION 'F6-D.2a: pedido alterou funnel_status (% -> %)', v_stage_before, v_stage_after;
  END IF;

  IF v_last_purchase IS NULL THEN
    RAISE EXCEPTION 'F6-D.2a: last_purchase_date não foi atualizado';
  END IF;

  SELECT count(*) INTO v_history_after
    FROM public.contact_history WHERE contact_id = v_order.contact_id;

  IF v_history_after <= v_history_before THEN
    RAISE EXCEPTION 'F6-D.2a: histórico de entrega não foi registrado';
  END IF;

  SELECT event_metadata INTO v_metadata
    FROM public.contact_history
   WHERE contact_id = v_order.contact_id
     AND event_type = 'order_delivered'
   ORDER BY interaction_date DESC
   LIMIT 1;

  IF v_metadata->>'order_id' IS DISTINCT FROM v_order.id::text THEN
    RAISE EXCEPTION 'F6-D.2a: order_id estruturado incorreto';
  END IF;

  UPDATE public.orders SET status = 'cancelado' WHERE id = v_order.id;

  SELECT funnel_status INTO v_stage_after
    FROM public.contacts WHERE id = v_order.contact_id;

  IF v_stage_after IS DISTINCT FROM v_stage_before THEN
    RAISE EXCEPTION 'F6-D.2a: cancelamento alterou funnel_status';
  END IF;

  SELECT event_metadata INTO v_metadata
    FROM public.contact_history
   WHERE contact_id = v_order.contact_id
     AND event_type = 'order_cancelled'
   ORDER BY interaction_date DESC
   LIMIT 1;

  IF v_metadata->>'order_id' IS DISTINCT FROM v_order.id::text THEN
    RAISE EXCEPTION 'F6-D.2a: cancelamento sem order_id estruturado correto';
  END IF;
END
$do$;

ROLLBACK;
