-- Produção Real — correção gerencial auditável.
-- "Excluir" reverte o fato e suas consequências físicas sem apagar histórico.
-- "Editar" reverte o fato original e registra um novo fato corrigido.
-- Regras de segurança:
-- - somente Administrador / LIDER PRODUÇÃO;
-- - não permite fato já incluído em Fechamento;
-- - não permite fato com materiais pendentes;
-- - não permite lote intermediário nesta etapa;
-- - reversão exige saldo suficiente do produto acabado;
-- - edição exige BOM atual compatível com o snapshot original.

ALTER TABLE public.production_facts
  ADD COLUMN IF NOT EXISTS correction_of_id uuid NULL
    REFERENCES public.production_facts(id) ON DELETE RESTRICT;

CREATE UNIQUE INDEX IF NOT EXISTS production_facts_correction_once_unique
  ON public.production_facts(correction_of_id)
  WHERE correction_of_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.reverse_production_fact(
  p_production_fact_id uuid,
  p_reason text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_fact public.production_facts%ROWTYPE;
  v_reversal_id uuid;
  v_finished record;
  v_consumed record;
  v_inventory_qty numeric;
  v_previous numeric;
  v_new numeric;
  v_location_id uuid;
  v_finished_count integer := 0;
  v_order public.production_orders%ROWTYPE;
  v_planned numeric := 0;
  v_remaining_produced numeric := 0;
BEGIN
  IF auth.role() <> 'service_role'
     AND COALESCE(public.current_app_user_role(), '') NOT IN ('Administrador','LIDER PRODUÇÃO') THEN
    RAISE EXCEPTION 'production_fact_manager_required';
  END IF;

  IF p_reason IS NULL OR btrim(p_reason) = '' THEN
    RETURN jsonb_build_object('success', false, 'reason', 'reason_required');
  END IF;

  SELECT * INTO v_fact
  FROM public.production_facts
  WHERE id = p_production_fact_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'reason', 'production_fact_not_found');
  END IF;

  IF v_fact.status = 'reversed' THEN
    SELECT id INTO v_reversal_id
    FROM public.production_facts
    WHERE reversal_of_id = v_fact.id
    LIMIT 1;

    RETURN jsonb_build_object(
      'success', true,
      'already_reversed', true,
      'production_fact_id', v_fact.id,
      'reversal_fact_id', v_reversal_id
    );
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.id = v_fact.product_id
      AND COALESCE(p.is_intermediate,false) = true
  ) THEN
    RETURN jsonb_build_object('success', false, 'reason', 'intermediate_fact_not_supported');
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.production_fact_consumptions pfc
    WHERE pfc.production_fact_id = v_fact.id
      AND pfc.quantity_applied < pfc.quantity_consumed
  ) THEN
    RETURN jsonb_build_object('success', false, 'reason', 'pending_material_adjustment');
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.production_fact_process_entries fpe
    JOIN public.production_closing_sources pcs
      ON pcs.source_type = 'production_fact_process_entry'
     AND pcs.source_id = fpe.id
    WHERE fpe.production_fact_id = v_fact.id
  ) THEN
    RETURN jsonb_build_object('success', false, 'reason', 'production_fact_in_closing');
  END IF;

  -- Valida antes de qualquer mutação se o produto acabado ainda pode ser retirado.
  FOR v_finished IN
    SELECT im.*
    FROM public.inventory_movements im
    WHERE im.reference_type = 'production_fact'
      AND im.reference_id = v_fact.id
      AND im.movement_type = 'in'
      AND im.product_id = v_fact.product_id
      AND im.variant_id IS NOT DISTINCT FROM v_fact.variant_id
    ORDER BY im.created_at, im.id
  LOOP
    v_finished_count := v_finished_count + 1;

    SELECT quantity INTO v_inventory_qty
    FROM public.inventory
    WHERE product_id = v_finished.product_id
      AND variant_id IS NOT DISTINCT FROM v_finished.variant_id
      AND location = v_finished.location
    FOR UPDATE;

    IF v_inventory_qty IS NULL OR v_inventory_qty < v_finished.quantity THEN
      RETURN jsonb_build_object(
        'success', false,
        'reason', 'insufficient_finished_stock',
        'location', v_finished.location,
        'required_quantity', v_finished.quantity,
        'available_quantity', COALESCE(v_inventory_qty,0)
      );
    END IF;
  END LOOP;

  IF v_finished_count = 0 THEN
    RETURN jsonb_build_object('success', false, 'reason', 'finished_movement_not_found');
  END IF;

  INSERT INTO public.production_facts(
    product_id, variant_id, quantity, location, location_id,
    operator_name, operator_user_id, occurred_at, production_order_id,
    source, status, event_key, reversal_of_id, created_by
  ) VALUES (
    v_fact.product_id, v_fact.variant_id, v_fact.quantity, v_fact.location, v_fact.location_id,
    v_fact.operator_name, v_fact.operator_user_id, now(), v_fact.production_order_id,
    'correction', 'reversed',
    'production_fact_reversal:' || v_fact.id::text,
    v_fact.id,
    auth.uid()
  )
  RETURNING id INTO v_reversal_id;

  -- Retira do estoque o produto acabado criado pelo fato original.
  FOR v_finished IN
    SELECT im.*
    FROM public.inventory_movements im
    WHERE im.reference_type = 'production_fact'
      AND im.reference_id = v_fact.id
      AND im.movement_type = 'in'
      AND im.product_id = v_fact.product_id
      AND im.variant_id IS NOT DISTINCT FROM v_fact.variant_id
    ORDER BY im.created_at, im.id
  LOOP
    SELECT quantity INTO v_previous
    FROM public.inventory
    WHERE product_id = v_finished.product_id
      AND variant_id IS NOT DISTINCT FROM v_finished.variant_id
      AND location = v_finished.location
    FOR UPDATE;

    v_new := v_previous - v_finished.quantity;

    UPDATE public.inventory
    SET quantity = v_new, updated_at = now()
    WHERE product_id = v_finished.product_id
      AND variant_id IS NOT DISTINCT FROM v_finished.variant_id
      AND location = v_finished.location;

    INSERT INTO public.inventory_movements(
      product_id, variant_id, movement_type, quantity,
      previous_balance, new_balance, location,
      reference_type, reference_id, event_key, notes, created_by
    ) VALUES (
      v_finished.product_id, v_finished.variant_id, 'out', v_finished.quantity,
      v_previous, v_new, v_finished.location,
      'production_fact_reversal', v_reversal_id,
      'production_fact:' || v_fact.id::text || ':reversal:finished:' || v_finished.id::text,
      'Reversão de produto acabado. Motivo: ' || btrim(p_reason),
      auth.uid()::text
    );
  END LOOP;

  -- Devolve exatamente os materiais que efetivamente foram consumidos pelo fato.
  FOR v_consumed IN
    SELECT im.*
    FROM public.inventory_movements im
    WHERE im.reference_id = v_fact.id
      AND im.reference_type IN ('production_fact','production_fact_reconciliation')
      AND im.movement_type = 'consume'
    ORDER BY im.created_at, im.id
  LOOP
    SELECT id INTO v_location_id
    FROM public.storage_locations
    WHERE name = v_consumed.location
      AND is_active = true
    LIMIT 1;

    INSERT INTO public.inventory(
      product_id, variant_id, location, location_id, quantity, updated_at
    ) VALUES (
      v_consumed.product_id, v_consumed.variant_id, v_consumed.location,
      v_location_id, 0, now()
    )
    ON CONFLICT(product_id, variant_id, location)
    DO UPDATE SET
      location_id = COALESCE(public.inventory.location_id, EXCLUDED.location_id);

    SELECT quantity INTO v_previous
    FROM public.inventory
    WHERE product_id = v_consumed.product_id
      AND variant_id IS NOT DISTINCT FROM v_consumed.variant_id
      AND location = v_consumed.location
    FOR UPDATE;

    v_new := v_previous + v_consumed.quantity;

    UPDATE public.inventory
    SET quantity = v_new,
        location_id = COALESCE(location_id, v_location_id),
        updated_at = now()
    WHERE product_id = v_consumed.product_id
      AND variant_id IS NOT DISTINCT FROM v_consumed.variant_id
      AND location = v_consumed.location;

    INSERT INTO public.inventory_movements(
      product_id, variant_id, movement_type, quantity,
      previous_balance, new_balance, location,
      reference_type, reference_id, event_key, notes, created_by
    ) VALUES (
      v_consumed.product_id, v_consumed.variant_id, 'in', v_consumed.quantity,
      v_previous, v_new, v_consumed.location,
      'production_fact_reversal', v_reversal_id,
      'production_fact:' || v_fact.id::text || ':reversal:component:' || v_consumed.id::text,
      'Devolução de material por reversão de produção. Motivo: ' || btrim(p_reason),
      auth.uid()::text
    );
  END LOOP;

  UPDATE public.production_facts
  SET status = 'reversed'
  WHERE id = v_fact.id;

  -- Se o fato estava ligado a uma OP factual, devolve a OP ao estado coerente.
  IF v_fact.production_order_id IS NOT NULL THEN
    SELECT * INTO v_order
    FROM public.production_orders
    WHERE id = v_fact.production_order_id
    FOR UPDATE;

    IF FOUND AND v_order.physical_flow_mode = 'production_facts' THEN
      SELECT COALESCE(sum(planned_quantity),0)
      INTO v_planned
      FROM public.production_order_items
      WHERE production_order_id = v_order.id;

      IF v_planned <= 0 THEN
        v_planned := COALESCE(v_order.target_quantity,0);
      END IF;

      SELECT COALESCE(sum(quantity),0)
      INTO v_remaining_produced
      FROM public.production_facts
      WHERE production_order_id = v_order.id
        AND status = 'confirmed';

      IF v_remaining_produced <= 0
         AND v_order.status IN ('producao','concluido') THEN
        UPDATE public.production_orders
        SET status = 'aberto', completed_at = NULL, updated_at = now()
        WHERE id = v_order.id;
      ELSIF v_remaining_produced < v_planned
         AND v_order.status = 'concluido' THEN
        UPDATE public.production_orders
        SET status = 'producao', completed_at = NULL, updated_at = now()
        WHERE id = v_order.id;
      END IF;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'already_reversed', false,
    'production_fact_id', v_fact.id,
    'reversal_fact_id', v_reversal_id,
    'reason_text', btrim(p_reason)
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.correct_production_fact(
  p_production_fact_id uuid,
  p_quantity numeric,
  p_occurred_at timestamptz,
  p_reason text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_fact public.production_facts%ROWTYPE;
  v_old_order_status text;
  v_old_completed_at timestamptz;
  v_bom_mismatch integer := 0;
  v_reverse jsonb;
  v_register jsonb;
  v_new_fact_id uuid;
  v_event_key text;
  v_operator_user_id uuid;
  v_planned numeric := 0;
  v_produced numeric := 0;
BEGIN
  IF auth.role() <> 'service_role'
     AND COALESCE(public.current_app_user_role(), '') NOT IN ('Administrador','LIDER PRODUÇÃO') THEN
    RAISE EXCEPTION 'production_fact_manager_required';
  END IF;

  IF p_quantity IS NULL OR p_quantity <= 0 THEN
    RETURN jsonb_build_object('success', false, 'reason', 'invalid_quantity');
  END IF;

  IF p_occurred_at IS NULL THEN
    RETURN jsonb_build_object('success', false, 'reason', 'occurred_at_required');
  END IF;

  IF p_reason IS NULL OR btrim(p_reason) = '' THEN
    RETURN jsonb_build_object('success', false, 'reason', 'reason_required');
  END IF;

  SELECT * INTO v_fact
  FROM public.production_facts
  WHERE id = p_production_fact_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'reason', 'production_fact_not_found');
  END IF;

  IF v_fact.status <> 'confirmed' THEN
    RETURN jsonb_build_object('success', false, 'reason', 'production_fact_not_confirmed');
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.id = v_fact.product_id
      AND COALESCE(p.is_intermediate,false) = true
  ) THEN
    RETURN jsonb_build_object('success', false, 'reason', 'intermediate_fact_not_supported');
  END IF;

  -- Para editar com segurança, a BOM atual precisa continuar igual ao snapshot
  -- do fato original. Caso contrário a correção deve ser analisada manualmente.
  WITH current_bom AS (
    SELECT component_id, variant_id, sum(qty_per_unit) AS qty_per_unit
    FROM public.product_components
    WHERE product_id = v_fact.product_id
      AND product_variant_id IS NOT DISTINCT FROM v_fact.variant_id
    GROUP BY component_id, variant_id
  ),
  snapshot_bom AS (
    SELECT component_id, variant_id, sum(qty_per_unit_snapshot) AS qty_per_unit
    FROM public.production_fact_consumptions
    WHERE production_fact_id = v_fact.id
    GROUP BY component_id, variant_id
  )
  SELECT count(*)
  INTO v_bom_mismatch
  FROM (
    SELECT
      c.component_id AS c_component_id,
      c.variant_id AS c_variant_id,
      c.qty_per_unit AS c_qty,
      s.component_id AS s_component_id,
      s.variant_id AS s_variant_id,
      s.qty_per_unit AS s_qty
    FROM current_bom c
    FULL OUTER JOIN snapshot_bom s
      ON s.component_id = c.component_id
     AND s.variant_id IS NOT DISTINCT FROM c.variant_id
  ) x
  WHERE c_component_id IS NULL
     OR s_component_id IS NULL
     OR abs(COALESCE(c_qty,0) - COALESCE(s_qty,0)) > 0.000000001;

  IF v_bom_mismatch > 0 THEN
    RETURN jsonb_build_object('success', false, 'reason', 'bom_changed_review_required');
  END IF;

  IF v_fact.production_order_id IS NOT NULL THEN
    SELECT status, completed_at
    INTO v_old_order_status, v_old_completed_at
    FROM public.production_orders
    WHERE id = v_fact.production_order_id;
  END IF;

  v_reverse := public.reverse_production_fact(v_fact.id, p_reason);

  IF NOT COALESCE((v_reverse->>'success')::boolean,false) THEN
    RETURN v_reverse;
  END IF;

  -- Se o operador original ficou inativo, preserva o nome e não força o id.
  SELECT CASE
           WHEN EXISTS(
             SELECT 1 FROM public.app_users u
             WHERE u.id = v_fact.operator_user_id AND u.is_active
           )
           THEN v_fact.operator_user_id
           ELSE NULL
         END
  INTO v_operator_user_id;

  v_event_key := 'production_fact_correction:' || v_fact.id::text || ':' || gen_random_uuid()::text;

  v_register := public.register_production_fact(
    v_fact.product_id,
    v_fact.variant_id,
    p_quantity,
    v_event_key,
    v_fact.location,
    v_operator_user_id,
    v_fact.operator_name,
    v_fact.production_order_id,
    p_occurred_at
  );

  IF NOT COALESCE((v_register->>'success')::boolean,false) THEN
    RAISE EXCEPTION 'production_fact_correction_failed:%', COALESCE(v_register->>'reason','unknown');
  END IF;

  v_new_fact_id := (v_register->>'production_fact_id')::uuid;

  UPDATE public.production_facts
  SET source = 'correction',
      correction_of_id = v_fact.id
  WHERE id = v_new_fact_id;

  -- Preserva operadores/processos e o valor unitário histórico do apontamento original.
  INSERT INTO public.production_fact_process_entries(
    production_fact_id, process_id, operator_user_id, operator_name,
    quantity, value_per_unit_snapshot, total_value, created_at, updated_at, occurred_at
  )
  SELECT
    v_new_fact_id, process_id, operator_user_id, operator_name,
    p_quantity, value_per_unit_snapshot, p_quantity * value_per_unit_snapshot,
    now(), now(), p_occurred_at
  FROM public.production_fact_process_entries
  WHERE production_fact_id = v_fact.id;

  -- Se a OP estava concluída e a correção ainda mantém a quantidade suficiente,
  -- restaura o estado concluído. Caso contrário permanece reaberta.
  IF v_fact.production_order_id IS NOT NULL
     AND v_old_order_status = 'concluido' THEN
    SELECT COALESCE(sum(planned_quantity),0)
    INTO v_planned
    FROM public.production_order_items
    WHERE production_order_id = v_fact.production_order_id;

    IF v_planned <= 0 THEN
      SELECT COALESCE(target_quantity,0)
      INTO v_planned
      FROM public.production_orders
      WHERE id = v_fact.production_order_id;
    END IF;

    SELECT COALESCE(sum(quantity),0)
    INTO v_produced
    FROM public.production_facts
    WHERE production_order_id = v_fact.production_order_id
      AND status = 'confirmed';

    IF v_produced >= v_planned THEN
      UPDATE public.production_orders
      SET status = 'concluido',
          completed_at = COALESCE(v_old_completed_at, now()),
          updated_at = now()
      WHERE id = v_fact.production_order_id;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'original_fact_id', v_fact.id,
    'corrected_fact_id', v_new_fact_id,
    'quantity', p_quantity,
    'occurred_at', p_occurred_at,
    'reason_text', btrim(p_reason)
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.reverse_production_fact(uuid,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.correct_production_fact(uuid,numeric,timestamptz,text) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.reverse_production_fact(uuid,text)
TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.correct_production_fact(uuid,numeric,timestamptz,text)
TO authenticated, service_role;

COMMENT ON FUNCTION public.reverse_production_fact(uuid,text) IS
  'Reverte de forma auditável um fato de produção confirmado, desfaz estoque/consumos e preserva o histórico.';
COMMENT ON FUNCTION public.correct_production_fact(uuid,numeric,timestamptz,text) IS
  'Corrige quantidade/data-hora por reversão auditável do fato original e criação de novo fato canônico.';
