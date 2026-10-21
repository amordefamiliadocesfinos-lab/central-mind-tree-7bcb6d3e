-- Porto Gel model B cutover. Run only after helper migration.
-- Prerequisites checked transactionally; old identifiers and movement history preserved.
BEGIN;
DO $$
BEGIN
 IF (SELECT COALESCE(SUM(quantity),0) FROM public.inventory WHERE product_id='6e757550-a9b6-4644-8164-8c802760e373'::uuid AND variant_id='7b47eed6-01fc-41e3-80f7-9893ce23316b'::uuid AND location='Fábrica')<>140000
 OR (SELECT COALESCE(SUM(quantity),0) FROM public.inventory WHERE product_id='6e757550-a9b6-4644-8164-8c802760e373'::uuid AND variant_id='a753c551-7389-403f-960a-70e0158763ab'::uuid AND location='Fábrica')<>27000
 OR (SELECT COALESCE(SUM(quantity),0) FROM public.inventory WHERE product_id='6e757550-a9b6-4644-8164-8c802760e373'::uuid AND variant_id='b37ef82d-743b-4d34-a023-1b66c2817672'::uuid AND location='Fábrica')<>35000
 THEN RAISE EXCEPTION 'Porto Gel inventory changed since authorized baseline. Stop cutover'; END IF;
 IF EXISTS (SELECT 1 FROM public.inventory WHERE product_id='6e757550-a9b6-4644-8164-8c802760e373'::uuid AND location<>'Fábrica' AND quantity<>0) THEN
 RAISE EXCEPTION 'Other stock location must be reconciled'; END IF;
 IF (SELECT count(*) FROM public.product_batch_recipe_items WHERE component_product_id='6e757550-a9b6-4644-8164-8c802760e373'::uuid AND component_variant_id='7b47eed6-01fc-41e3-80f7-9893ce23316b'::uuid)<>55 THEN RAISE EXCEPTION 'Recipe inventory changed'; END IF;
 IF (SELECT count(*) FROM public.product_components WHERE component_id='6e757550-a9b6-4644-8164-8c802760e373'::uuid AND variant_id='7b47eed6-01fc-41e3-80f7-9893ce23316b'::uuid)<>16 THEN RAISE EXCEPTION 'BOM changed'; END IF;
 IF (SELECT count(*) FROM public.commercial_presentations WHERE product_id='6e757550-a9b6-4644-8164-8c802760e373'::uuid)<>5 THEN RAISE EXCEPTION 'Commercial presentations changed'; END IF;
 IF EXISTS (SELECT 1 FROM public.inventory WHERE variant_id IN ('9173505d-7720-40b6-8040-84d68a3c2334','5d4602ba-0db4-4095-8866-6e702fa192c5','ae7c8013-de6c-4806-9450-abcab2202aa9','fcf97062-683f-4921-b941-5236613c32fb')::uuid[]) THEN RAISE EXCEPTION 'Target identities already stocked'; END IF;
 IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname='ensure_portogel_production_material') THEN RAISE EXCEPTION 'Atomic helper missing'; END IF;
END $$;
-- Activate new physical identities only within the same transaction.
UPDATE public.product_variants SET is_active=true,
 cost_override=CASE sku
   WHEN 'EMUL-PORTOGEL-NEW-10KG-UN' THEN 138.96
   WHEN 'EMUL-PORTOGEL-NEW-3KG-UN' THEN 43.38
   WHEN 'EMUL-PORTOGEL-NEW-1KG-UN' THEN 15.36
   ELSE NULL END
 WHERE product_id='6e757550-a9b6-4644-8164-8c802760e373'::uuid
 AND sku IN ('EMUL-PORTOGEL-NEW-10KG-UN','EMUL-PORTOGEL-NEW-3KG-UN','EMUL-PORTOGEL-NEW-1KG-UN','EMUL-PORTOGEL-PRODUCAO-G');
-- Redirect BOM writers to gram consumption identity; amounts remain in grams.
UPDATE public.product_batch_recipe_items SET component_variant_id='fcf97062-683f-4921-b941-5236613c32fb'::uuid WHERE component_product_id='6e757550-a9b6-4644-8164-8c802760e373'::uuid AND component_variant_id='7b47eed6-01fc-41e3-80f7-9893ce23316b'::uuid;
UPDATE public.product_components SET variant_id='fcf97062-683f-4921-b941-5236613c32fb'::uuid WHERE component_id='6e757550-a9b6-4644-8164-8c802760e373'::uuid AND variant_id='7b47eed6-01fc-41e3-80f7-9893ce23316b'::uuid;
-- Preserve commercial presentation IDs, change their physical semantics for FUTURE orders.
UPDATE public.commercial_presentations SET variant_id='9173505d-7720-40b6-8040-84d68a3c2334'::uuid,conversion_factor=1,name='Porto Gel — Embalagem 10 kg',commercial_unit_label='embalagem' WHERE id='835c11b2-71e2-4f93-ab9a-d434dedf48a6';
UPDATE public.commercial_presentations SET variant_id='5d4602ba-0db4-4095-8866-6e702fa192c5'::uuid,conversion_factor=1,name='Porto Gel — Embalagem 3 kg',commercial_unit_label='embalagem' WHERE id='cd0d4412-77ee-4629-b803-60f3b9df8aab';
UPDATE public.commercial_presentations SET variant_id='ae7c8013-de6c-4806-9450-abcab2202aa9'::uuid,conversion_factor=1,name='Porto Gel — Embalagem 1 kg',commercial_unit_label='embalagem' WHERE id='c53b2af6-a106-4e71-8b2e-d51810b50ac8';
UPDATE public.commercial_presentation_components SET variant_id='ae7c8013-de6c-4806-9450-abcab2202aa9'::uuid,quantity=2 WHERE presentation_id='908ee0d8-c603-4e71-afb2-133994e89e7a';
UPDATE public.commercial_presentation_components SET variant_id='ae7c8013-de6c-4806-9450-abcab2202aa9'::uuid,quantity=1 WHERE presentation_id='7fe94e4f-a5f3-45b0-837f-b103b724ed5e' AND variant_id='b37ef82d-743b-4d34-a023-1b66c2817672'::uuid;
UPDATE public.commercial_presentation_components SET variant_id='5d4602ba-0db4-4095-8866-6e702fa192c5'::uuid,quantity=1 WHERE presentation_id='7fe94e4f-a5f3-45b0-837f-b103b724ed5e' AND variant_id='a753c551-7389-403f-960a-70e0158763ab'::uuid;
UPDATE public.commercial_presentations SET conversion_factor=2 WHERE id IN ('908ee0d8-c603-4e71-afb2-133994e89e7a','7fe94e4f-a5f3-45b0-837f-b103b724ed5e');
-- Pending sales mappings must use 1 physical package per selected 1-kg model.
UPDATE public.marketplace_product_mapping_items SET variant_id='ae7c8013-de6c-4806-9450-abcab2202aa9'::uuid,physical_multiplier=1 WHERE product_id='6e757550-a9b6-4644-8164-8c802760e373'::uuid AND variant_id='b37ef82d-743b-4d34-a023-1b66c2817672'::uuid;
UPDATE public.marketplace_product_mappings SET variant_id='ae7c8013-de6c-4806-9450-abcab2202aa9'::uuid,physical_multiplier=1 WHERE variant_id='b37ef82d-743b-4d34-a023-1b66c2817672'::uuid;
-- New receipts: boxes of 12x1kg and 4x3kg, and bucket of 10kg.
UPDATE public.purchase_presentations SET variant_id='ae7c8013-de6c-4806-9450-abcab2202aa9'::uuid,stock_unit_label='un',conversion_factor=12 WHERE id='16521ea8-14d3-457e-80c8-261694248073';
UPDATE public.purchase_presentations SET variant_id='5d4602ba-0db4-4095-8866-6e702fa192c5'::uuid,stock_unit_label='un',conversion_factor=4 WHERE id='ea30837d-94e9-45a4-87d3-7cbd3a0f957c';
UPDATE public.purchase_presentations SET variant_id='9173505d-7720-40b6-8040-84d68a3c2334'::uuid,stock_unit_label='un',conversion_factor=1 WHERE id='e96303c6-f965-4bd0-a6fc-3a1d8fb73ff2';
-- Historical purchase orders already received remain untouched.
-- Transfer original gram balances into whole, closed packaging units.
WITH legacy AS (
 SELECT i.id,i.variant_id,i.quantity old_quantity,
 CASE i.variant_id
 WHEN '7b47eed6-01fc-41e3-80f7-9893ce23316b'::uuid THEN '9173505d-7720-40b6-8040-84d68a3c2334'::uuid
 WHEN 'a753c551-7389-403f-960a-70e0158763ab'::uuid THEN '5d4602ba-0db4-4095-8866-6e702fa192c5'::uuid
 ELSE 'ae7c8013-de6c-4806-9450-abcab2202aa9'::uuid END new_variant,
 CASE i.variant_id
 WHEN '7b47eed6-01fc-41e3-80f7-9893ce23316b'::uuid THEN 10000
 WHEN 'a753c551-7389-403f-960a-70e0158763ab'::uuid THEN 3000
 ELSE 1000 END grams_per_package
 FROM public.inventory i WHERE i.product_id='6e757550-a9b6-4644-8164-8c802760e373'::uuid AND i.quantity>0
 AND i.variant_id IN ('7b47eed6-01fc-41e3-80f7-9893ce23316b'::uuid,'a753c551-7389-403f-960a-70e0158763ab'::uuid,'b37ef82d-743b-4d34-a023-1b66c2817672'::uuid)
), out_entries AS (
 INSERT INTO public.inventory_movements (product_id,variant_id,movement_type,quantity,previous_balance,new_balance,location,reference_type,event_key,notes)
 SELECT '6e757550-a9b6-4644-8164-8c802760e373'::uuid,variant_id,'out',old_quantity,old_quantity,0,'Fábrica','unit_model_migration','portogel:unit_cutover:old:'||variant_id::text,'Reclassificação de unidade física; saldo histórico em gramas'
 FROM legacy RETURNING id
), inserted AS (
 INSERT INTO public.inventory (product_id,variant_id,location,quantity,updated_at)
 SELECT '6e757550-a9b6-4644-8164-8c802760e373'::uuid,new_variant,'Fábrica',old_quantity/grams_per_package,now()
 FROM legacy RETURNING variant_id,quantity
), new_entries AS (
 INSERT INTO public.inventory_movements (product_id,variant_id,movement_type,quantity,previous_balance,new_balance,location,reference_type,event_key,notes)
 SELECT '6e757550-a9b6-4644-8164-8c802760e373'::uuid,variant_id,'in',quantity,0,quantity,'Fábrica','unit_model_migration','portogel:unit_cutover:new:'||variant_id::text,'Reclassificação de unidade física; embalagem fechada'
 FROM inserted RETURNING id
)
UPDATE public.inventory i SET quantity=0,updated_at=now() WHERE i.product_id='6e757550-a9b6-4644-8164-8c802760e373'::uuid
AND i.variant_id IN ('7b47eed6-01fc-41e3-80f7-9893ce23316b'::uuid,'a753c551-7389-403f-960a-70e0158763ab'::uuid,'b37ef82d-743b-4d34-a023-1b66c2817672'::uuid);
INSERT INTO public.inventory (product_id,variant_id,location,quantity,updated_at)
VALUES ('6e757550-a9b6-4644-8164-8c802760e373'::uuid,'fcf97062-683f-4921-b941-5236613c32fb'::uuid,'Fábrica',0,now());
-- Do not let new operations accidentally select legacy gram-based packaging variants.
UPDATE public.product_variants SET is_active=false WHERE product_id='6e757550-a9b6-4644-8164-8c802760e373'::uuid
AND id IN ('7b47eed6-01fc-41e3-80f7-9893ce23316b','a753c551-7389-403f-960a-70e0158763ab','b37ef82d-743b-4d34-a023-1b66c2817672');
;
CREATE OR REPLACE FUNCTION public.register_production_fact(p_product_id uuid, p_variant_id uuid, p_quantity numeric, p_event_key text, p_location text DEFAULT 'Fábrica'::text, p_operator_user_id uuid DEFAULT NULL::uuid, p_operator_name text DEFAULT NULL::text, p_production_order_id uuid DEFAULT NULL::uuid, p_occurred_at timestamp with time zone DEFAULT now())
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_existing public.production_facts;
  v_fact_id uuid;
  v_location text := COALESCE(NULLIF(btrim(p_location), ''), 'Fábrica');
  v_location_id uuid;
  v_operator_name text;
  v_resolved_order_id uuid := p_production_order_id;
  v_candidate_count integer := 0;
  v_order_mode text;
  v_order_status text;
  v_component record;
  v_inventory record;
  v_remaining numeric;
  v_take numeric;
  v_applied numeric;
  v_previous numeric;
  v_new numeric;
  v_shortages jsonb := '[]'::jsonb;
  v_consumption_count integer := 0;
  v_movement_count integer := 0;
  v_finished_key text;
BEGIN
  IF p_event_key IS NULL OR btrim(p_event_key) = '' THEN
    RETURN jsonb_build_object('success', false, 'reason', 'missing_event_key');
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(p_event_key, 0));

  SELECT * INTO v_existing
  FROM public.production_facts
  WHERE event_key = p_event_key;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'success', true,
      'already_processed', true,
      'production_fact_id', v_existing.id,
      'product_id', v_existing.product_id,
      'variant_id', v_existing.variant_id,
      'quantity', v_existing.quantity,
      'location', v_existing.location,
      'production_order_id', v_existing.production_order_id,
      'material_adjustment_required', EXISTS (
        SELECT 1 FROM public.production_fact_consumptions pfc
        WHERE pfc.production_fact_id = v_existing.id
          AND pfc.adjustment_status = 'pending'
      ),
      'consumption_count', 0,
      'inventory_movement_count', 0
    );
  END IF;

  IF p_quantity IS NULL OR p_quantity <= 0 THEN
    RETURN jsonb_build_object('success', false, 'reason', 'invalid_quantity');
  END IF;

  PERFORM public.assert_physical_identity(p_product_id, p_variant_id, 'production_fact');

  SELECT id INTO v_location_id
  FROM public.storage_locations
  WHERE name = v_location AND is_active = true
  LIMIT 1;

  IF v_location_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'reason', 'invalid_location', 'location', v_location);
  END IF;

  IF p_operator_user_id IS NOT NULL THEN
    SELECT name INTO v_operator_name
    FROM public.app_users
    WHERE id = p_operator_user_id AND is_active = true;
    IF v_operator_name IS NULL THEN
      RETURN jsonb_build_object('success', false, 'reason', 'invalid_operator');
    END IF;
  ELSE
    v_operator_name := NULLIF(btrim(p_operator_name), '');
  END IF;

  IF v_resolved_order_id IS NOT NULL THEN
    SELECT physical_flow_mode, status INTO v_order_mode, v_order_status
    FROM public.production_orders
    WHERE id = v_resolved_order_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RETURN jsonb_build_object('success', false, 'reason', 'production_order_not_found');
    END IF;
    IF v_order_status = 'cancelado' THEN
      RETURN jsonb_build_object('success', false, 'reason', 'production_order_cancelled');
    END IF;
    IF v_order_mode <> 'production_facts' THEN
      RETURN jsonb_build_object('success', false, 'reason', 'production_order_legacy_mode');
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM public.production_order_items poi
      WHERE poi.production_order_id = v_resolved_order_id
        AND poi.product_id = p_product_id
        AND poi.variant_id IS NOT DISTINCT FROM p_variant_id
    ) THEN
      RETURN jsonb_build_object('success', false, 'reason', 'production_order_item_mismatch');
    END IF;
  ELSE
    SELECT count(*), max(candidate.id::text)::uuid
    INTO v_candidate_count, v_resolved_order_id
    FROM (
      SELECT DISTINCT po.id
      FROM public.production_orders po
      JOIN public.production_order_items poi ON poi.production_order_id = po.id
      WHERE po.physical_flow_mode = 'production_facts'
        AND po.status IN ('aberto', 'producao')
        AND poi.product_id = p_product_id
        AND poi.variant_id IS NOT DISTINCT FROM p_variant_id
    ) candidate;
    IF v_candidate_count <> 1 THEN v_resolved_order_id := NULL; END IF;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.product_components pc
    WHERE pc.product_id = p_product_id
      AND pc.product_variant_id IS NOT DISTINCT FROM p_variant_id
  ) THEN
    RETURN jsonb_build_object('success', false, 'reason', 'missing_bom');
  END IF;

  INSERT INTO public.production_facts(
    product_id, variant_id, quantity, location, location_id,
    operator_name, operator_user_id, occurred_at,
    production_order_id, source, status, event_key, created_by
  ) VALUES (
    p_product_id, p_variant_id, p_quantity, v_location, v_location_id,
    v_operator_name, p_operator_user_id, COALESCE(p_occurred_at, now()),
    v_resolved_order_id, 'mobile', 'confirmed', p_event_key, auth.uid()
  )
  ON CONFLICT (event_key) DO NOTHING
  RETURNING id INTO v_fact_id;

  IF v_fact_id IS NULL THEN
    SELECT * INTO v_existing FROM public.production_facts WHERE event_key = p_event_key;
    RETURN jsonb_build_object(
      'success', true,
      'already_processed', true,
      'production_fact_id', v_existing.id,
      'product_id', v_existing.product_id,
      'variant_id', v_existing.variant_id,
      'quantity', v_existing.quantity,
      'location', v_existing.location,
      'production_order_id', v_existing.production_order_id,
      'material_adjustment_required', EXISTS (
        SELECT 1 FROM public.production_fact_consumptions pfc
        WHERE pfc.production_fact_id = v_existing.id
          AND pfc.adjustment_status = 'pending'
      ),
      'consumption_count', 0,
      'inventory_movement_count', 0
    );
  END IF;

  INSERT INTO public.production_fact_consumptions(
    production_fact_id, component_id, variant_id,
    qty_per_unit_snapshot, quantity_consumed, quantity_applied,
    adjustment_status, unit_snapshot
  )
  SELECT
    v_fact_id,
    pc.component_id,
    pc.variant_id,
    sum(pc.qty_per_unit),
    sum(pc.qty_per_unit * p_quantity),
    0,
    CASE WHEN sum(pc.qty_per_unit * p_quantity) <= 0 THEN 'applied' ELSE 'pending' END,
    COALESCE(pv.unit, p.unit)
  FROM public.product_components pc
  JOIN public.products p ON p.id = pc.component_id
  LEFT JOIN public.product_variants pv ON pv.id = pc.variant_id
  WHERE pc.product_id = p_product_id
    AND pc.product_variant_id IS NOT DISTINCT FROM p_variant_id
  GROUP BY pc.component_id, pc.variant_id, p.unit, pv.unit;

  GET DIAGNOSTICS v_consumption_count = ROW_COUNT;

  FOR v_component IN
    SELECT pfc.id, pfc.component_id, pfc.variant_id,
           pfc.quantity_consumed, pfc.unit_snapshot,
           p.name AS component_name,
           pv.variant_name AS component_variant_name
    FROM public.production_fact_consumptions pfc
    JOIN public.products p ON p.id = pfc.component_id
    LEFT JOIN public.product_variants pv ON pv.id = pfc.variant_id
    WHERE pfc.production_fact_id = v_fact_id
    ORDER BY pfc.component_id, pfc.variant_id
  LOOP
    v_remaining := v_component.quantity_consumed;
    v_applied := 0;

    IF v_component.component_id = '6e757550-a9b6-4644-8164-8c802760e373'::uuid
       AND v_component.variant_id = 'fcf97062-683f-4921-b941-5236613c32fb'::uuid THEN
      PERFORM public.ensure_portogel_production_material(v_fact_id, v_remaining);
    END IF;

    FOR v_inventory IN
      SELECT id, location, quantity
      FROM public.inventory
      WHERE product_id = v_component.component_id
        AND variant_id IS NOT DISTINCT FROM v_component.variant_id
        AND quantity > 0
      ORDER BY id
      FOR UPDATE
    LOOP
      EXIT WHEN v_remaining <= 0;
      v_take := LEAST(v_remaining, v_inventory.quantity);

      UPDATE public.inventory
      SET quantity = quantity - v_take, updated_at = now()
      WHERE id = v_inventory.id;

      INSERT INTO public.inventory_movements(
        product_id, variant_id, movement_type, quantity,
        previous_balance, new_balance, location,
        reference_type, reference_id, event_key, notes
      ) VALUES (
        v_component.component_id,
        v_component.variant_id,
        'consume',
        v_take,
        v_inventory.quantity,
        v_inventory.quantity - v_take,
        v_inventory.location,
        'production_fact',
        v_fact_id,
        'production_fact:' || v_fact_id::text || ':consume:' || v_inventory.id::text,
        'Consumo disponível no registro do fato real de produção'
      );

      v_remaining := v_remaining - v_take;
      v_applied := v_applied + v_take;
      v_movement_count := v_movement_count + 1;
    END LOOP;

    UPDATE public.production_fact_consumptions
    SET quantity_applied = v_applied,
        adjustment_status = CASE WHEN v_remaining <= 0 THEN 'applied' ELSE 'pending' END
    WHERE id = v_component.id;

    IF v_remaining > 0 THEN
      v_shortages := v_shortages || jsonb_build_array(jsonb_build_object(
        'product_id', v_component.component_id,
        'variant_id', v_component.variant_id,
        'component_name', v_component.component_name,
        'component_variant_name', v_component.component_variant_name,
        'unit', v_component.unit_snapshot,
        'required_quantity', v_component.quantity_consumed,
        'applied_quantity', v_applied,
        'missing_quantity', v_remaining
      ));
    END IF;
  END LOOP;

  INSERT INTO public.inventory(
    product_id, variant_id, location, location_id, quantity, updated_at
  ) VALUES (
    p_product_id, p_variant_id, v_location, v_location_id, p_quantity, now()
  )
  ON CONFLICT(product_id, variant_id, location)
  DO UPDATE SET
    quantity = public.inventory.quantity + EXCLUDED.quantity,
    location_id = COALESCE(public.inventory.location_id, EXCLUDED.location_id),
    updated_at = now()
  RETURNING quantity - p_quantity, quantity INTO v_previous, v_new;

  v_finished_key := 'production_fact:' || v_fact_id::text || ':finished:' ||
                    p_product_id::text || ':' || COALESCE(p_variant_id::text, 'simple') || ':' ||
                    v_location_id::text;

  INSERT INTO public.inventory_movements(
    product_id, variant_id, movement_type, quantity,
    previous_balance, new_balance, location,
    reference_type, reference_id, event_key, notes
  ) VALUES (
    p_product_id, p_variant_id, 'in', p_quantity,
    v_previous, v_new, v_location,
    'production_fact', v_fact_id, v_finished_key,
    CASE WHEN jsonb_array_length(v_shortages) > 0
      THEN 'Entrada por fato real de produção com consumo de materiais pendente'
      ELSE 'Entrada por fato real de produção'
    END
  );

  v_movement_count := v_movement_count + 1;

  RETURN jsonb_build_object(
    'success', true,
    'already_processed', false,
    'production_fact_id', v_fact_id,
    'product_id', p_product_id,
    'variant_id', p_variant_id,
    'quantity', p_quantity,
    'location', v_location,
    'production_order_id', v_resolved_order_id,
    'material_adjustment_required', jsonb_array_length(v_shortages) > 0,
    'shortages', v_shortages,
    'consumption_count', v_consumption_count,
    'inventory_movement_count', v_movement_count
  );
END;
$function$
;
CREATE OR REPLACE FUNCTION public.reconcile_production_fact_materials(p_production_fact_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_fact public.production_facts;
  v_consumption record;
  v_inventory record;
  v_remaining numeric;
  v_take numeric;
  v_before_applied numeric;
  v_shortages jsonb := '[]'::jsonb;
  v_movement_count integer := 0;
BEGIN
  SELECT * INTO v_fact
  FROM public.production_facts
  WHERE id = p_production_fact_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'reason', 'production_fact_not_found');
  END IF;

  FOR v_consumption IN
    SELECT pfc.id, pfc.component_id, pfc.variant_id,
           pfc.quantity_consumed, pfc.quantity_applied,
           p.name AS component_name,
           pv.variant_name AS component_variant_name,
           pfc.unit_snapshot
    FROM public.production_fact_consumptions pfc
    JOIN public.products p ON p.id = pfc.component_id
    LEFT JOIN public.product_variants pv ON pv.id = pfc.variant_id
    WHERE pfc.production_fact_id = p_production_fact_id
      AND pfc.quantity_applied < pfc.quantity_consumed
    ORDER BY pfc.component_id, pfc.variant_id
    FOR UPDATE OF pfc
  LOOP
    v_remaining := v_consumption.quantity_consumed - v_consumption.quantity_applied;

    IF v_consumption.component_id = '6e757550-a9b6-4644-8164-8c802760e373'::uuid
       AND v_consumption.variant_id = 'fcf97062-683f-4921-b941-5236613c32fb'::uuid THEN
      PERFORM public.ensure_portogel_production_material(p_production_fact_id, v_remaining);
    END IF;

    FOR v_inventory IN
      SELECT id, location, quantity
      FROM public.inventory
      WHERE product_id = v_consumption.component_id
        AND variant_id IS NOT DISTINCT FROM v_consumption.variant_id
        AND quantity > 0
      ORDER BY id
      FOR UPDATE
    LOOP
      EXIT WHEN v_remaining <= 0;
      v_take := LEAST(v_remaining, v_inventory.quantity);
      v_before_applied := v_consumption.quantity_consumed - v_remaining;

      UPDATE public.inventory
      SET quantity = quantity - v_take,
          updated_at = now()
      WHERE id = v_inventory.id;

      INSERT INTO public.inventory_movements(
        product_id, variant_id, movement_type, quantity,
        previous_balance, new_balance, location,
        reference_type, reference_id, event_key, notes
      ) VALUES (
        v_consumption.component_id,
        v_consumption.variant_id,
        'consume',
        v_take,
        v_inventory.quantity,
        v_inventory.quantity - v_take,
        v_inventory.location,
        'production_fact_reconciliation',
        p_production_fact_id,
        'production_fact:' || p_production_fact_id::text || ':reconcile:' ||
          v_consumption.id::text || ':' || v_inventory.id::text || ':' || v_before_applied::text,
        'Regularização de consumo pendente da produção'
      );

      v_remaining := v_remaining - v_take;
      v_movement_count := v_movement_count + 1;
    END LOOP;

    UPDATE public.production_fact_consumptions
    SET quantity_applied = quantity_consumed - v_remaining,
        adjustment_status = CASE WHEN v_remaining <= 0 THEN 'applied' ELSE 'pending' END
    WHERE id = v_consumption.id;

    IF v_remaining > 0 THEN
      v_shortages := v_shortages || jsonb_build_array(jsonb_build_object(
        'component_id', v_consumption.component_id,
        'variant_id', v_consumption.variant_id,
        'component_name', v_consumption.component_name,
        'component_variant_name', v_consumption.component_variant_name,
        'unit', v_consumption.unit_snapshot,
        'missing_quantity', v_remaining
      ));
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'production_fact_id', p_production_fact_id,
    'all_resolved', jsonb_array_length(v_shortages) = 0,
    'shortages', v_shortages,
    'inventory_movement_count', v_movement_count
  );
END;
$function$
;
DO $$
DECLARE v_grams numeric;
BEGIN
 SELECT SUM(i.quantity * CASE v.sku
 WHEN 'EMUL-PORTOGEL-NEW-10KG-UN' THEN 10000
 WHEN 'EMUL-PORTOGEL-NEW-3KG-UN' THEN 3000
 WHEN 'EMUL-PORTOGEL-NEW-1KG-UN' THEN 1000
 WHEN 'EMUL-PORTOGEL-PRODUCAO-G' THEN 1 ELSE 0 END) INTO v_grams
 FROM public.inventory i JOIN public.product_variants v ON v.id=i.variant_id
 WHERE i.product_id='6e757550-a9b6-4644-8164-8c802760e373'::uuid;
 IF v_grams<>202000 THEN RAISE EXCEPTION 'Porto Gel mass reconciliation failed: %',v_grams; END IF;
END $$;
COMMIT;
