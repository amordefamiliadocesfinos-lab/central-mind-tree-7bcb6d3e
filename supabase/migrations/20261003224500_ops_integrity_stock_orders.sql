-- EXECUCAO 01-B — Integridade Operacional
-- Estoque somente por fatos/RPCs canonicas; Pedido permanece compromisso comercial.

CREATE OR REPLACE FUNCTION public.record_manual_inventory_movement(
  p_product_id uuid,
  p_variant_id uuid,
  p_operation text,
  p_quantity numeric,
  p_location text,
  p_to_location text,
  p_notes text,
  p_event_key text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_role text;
  v_event_key text;
  v_location_id uuid;
  v_to_location_id uuid;
  v_previous numeric := 0;
  v_new numeric := 0;
  v_destination_previous numeric := 0;
  v_destination_new numeric := 0;
BEGIN
  IF auth.role() <> 'service_role' THEN
    v_role := public.current_app_user_role();
    IF v_role IS NULL OR v_role NOT IN ('Administrador', 'LIDER PRODUÇÃO') THEN
      RAISE EXCEPTION 'inventory_manager_required';
    END IF;
  END IF;

  IF p_operation NOT IN ('entry', 'exit', 'transfer', 'adjust') THEN
    RAISE EXCEPTION 'Operacao manual de estoque invalida: %', p_operation;
  END IF;

  IF p_quantity IS NULL OR
     (p_operation = 'adjust' AND p_quantity < 0) OR
     (p_operation <> 'adjust' AND p_quantity <= 0) THEN
    RAISE EXCEPTION 'Quantidade invalida para movimentacao manual.';
  END IF;

  IF p_location IS NULL OR btrim(p_location) = '' THEN
    RAISE EXCEPTION 'Local de estoque obrigatorio.';
  END IF;

  PERFORM public.assert_physical_identity(p_product_id, p_variant_id, 'manual_inventory');

  SELECT id INTO v_location_id
  FROM public.storage_locations
  WHERE name = p_location AND is_active = true
  LIMIT 1;
  IF v_location_id IS NULL THEN
    RAISE EXCEPTION 'Local de estoque invalido ou inativo: %', p_location;
  END IF;

  IF p_operation = 'transfer' THEN
    IF p_to_location IS NULL OR btrim(p_to_location) = '' OR p_to_location = p_location THEN
      RAISE EXCEPTION 'Destino de transferencia invalido.';
    END IF;
    SELECT id INTO v_to_location_id
    FROM public.storage_locations
    WHERE name = p_to_location AND is_active = true
    LIMIT 1;
    IF v_to_location_id IS NULL THEN
      RAISE EXCEPTION 'Local de destino invalido ou inativo: %', p_to_location;
    END IF;
  END IF;

  v_event_key := COALESCE(NULLIF(btrim(p_event_key), ''), 'manual_inventory:' || gen_random_uuid()::text);

  PERFORM pg_advisory_xact_lock(
    hashtextextended(
      'manual_inventory:' || p_product_id::text || ':' || COALESCE(p_variant_id::text, 'simple'),
      0
    )
  );

  IF EXISTS (SELECT 1 FROM public.inventory_movements WHERE event_key = v_event_key) THEN
    RETURN jsonb_build_object('success', true, 'already_processed', true, 'event_key', v_event_key);
  END IF;

  INSERT INTO public.inventory(product_id, variant_id, location, location_id, quantity, updated_at)
  VALUES (p_product_id, p_variant_id, p_location, v_location_id, 0, now())
  ON CONFLICT(product_id, variant_id, location)
  DO UPDATE SET
    location_id = COALESCE(public.inventory.location_id, EXCLUDED.location_id),
    updated_at = public.inventory.updated_at;

  SELECT quantity INTO v_previous
  FROM public.inventory
  WHERE product_id = p_product_id
    AND variant_id IS NOT DISTINCT FROM p_variant_id
    AND location = p_location
  FOR UPDATE;

  IF p_operation = 'entry' THEN
    v_new := v_previous + p_quantity;
    UPDATE public.inventory
    SET quantity = v_new, location_id = v_location_id, updated_at = now()
    WHERE product_id = p_product_id
      AND variant_id IS NOT DISTINCT FROM p_variant_id
      AND location = p_location;

    INSERT INTO public.inventory_movements(
      product_id, variant_id, movement_type, quantity,
      previous_balance, new_balance, location,
      reference_type, event_key, notes, created_by
    ) VALUES (
      p_product_id, p_variant_id, 'in', p_quantity,
      v_previous, v_new, p_location,
      'manual_inventory', v_event_key, p_notes, auth.uid()::text
    );

  ELSIF p_operation = 'exit' THEN
    IF v_previous < p_quantity THEN
      RAISE EXCEPTION 'Saldo insuficiente em %. Disponivel: %', p_location, v_previous;
    END IF;
    v_new := v_previous - p_quantity;
    UPDATE public.inventory
    SET quantity = v_new, location_id = v_location_id, updated_at = now()
    WHERE product_id = p_product_id
      AND variant_id IS NOT DISTINCT FROM p_variant_id
      AND location = p_location;

    INSERT INTO public.inventory_movements(
      product_id, variant_id, movement_type, quantity,
      previous_balance, new_balance, location,
      reference_type, event_key, notes, created_by
    ) VALUES (
      p_product_id, p_variant_id, 'out', p_quantity,
      v_previous, v_new, p_location,
      'manual_inventory', v_event_key, p_notes, auth.uid()::text
    );

  ELSIF p_operation = 'adjust' THEN
    v_new := p_quantity;
    UPDATE public.inventory
    SET quantity = v_new, location_id = v_location_id, updated_at = now()
    WHERE product_id = p_product_id
      AND variant_id IS NOT DISTINCT FROM p_variant_id
      AND location = p_location;

    INSERT INTO public.inventory_movements(
      product_id, variant_id, movement_type, quantity,
      previous_balance, new_balance, location,
      reference_type, event_key, notes, created_by
    ) VALUES (
      p_product_id, p_variant_id, 'adjust', v_new - v_previous,
      v_previous, v_new, p_location,
      'manual_inventory', v_event_key,
      COALESCE(NULLIF(p_notes, ''), 'Ajuste manual de estoque'), auth.uid()::text
    );

  ELSE
    IF v_previous < p_quantity THEN
      RAISE EXCEPTION 'Saldo insuficiente em %. Disponivel: %', p_location, v_previous;
    END IF;

    INSERT INTO public.inventory(product_id, variant_id, location, location_id, quantity, updated_at)
    VALUES (p_product_id, p_variant_id, p_to_location, v_to_location_id, 0, now())
    ON CONFLICT(product_id, variant_id, location)
    DO UPDATE SET
      location_id = COALESCE(public.inventory.location_id, EXCLUDED.location_id),
      updated_at = public.inventory.updated_at;

    SELECT quantity INTO v_destination_previous
    FROM public.inventory
    WHERE product_id = p_product_id
      AND variant_id IS NOT DISTINCT FROM p_variant_id
      AND location = p_to_location
    FOR UPDATE;

    v_new := v_previous - p_quantity;
    v_destination_new := v_destination_previous + p_quantity;

    UPDATE public.inventory
    SET quantity = v_new, location_id = v_location_id, updated_at = now()
    WHERE product_id = p_product_id
      AND variant_id IS NOT DISTINCT FROM p_variant_id
      AND location = p_location;

    UPDATE public.inventory
    SET quantity = v_destination_new, location_id = v_to_location_id, updated_at = now()
    WHERE product_id = p_product_id
      AND variant_id IS NOT DISTINCT FROM p_variant_id
      AND location = p_to_location;

    INSERT INTO public.inventory_movements(
      product_id, variant_id, movement_type, quantity,
      previous_balance, new_balance, from_location, to_location,
      reference_type, event_key, notes, created_by
    ) VALUES (
      p_product_id, p_variant_id, 'transfer', p_quantity,
      v_previous, v_new, p_location, p_to_location,
      'manual_inventory', v_event_key,
      COALESCE(NULLIF(p_notes, ''), 'Transferencia de ' || p_location || ' para ' || p_to_location),
      auth.uid()::text
    );
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'already_processed', false,
    'operation', p_operation,
    'event_key', v_event_key,
    'previous_balance', v_previous,
    'new_balance', v_new,
    'destination_previous_balance', CASE WHEN p_operation = 'transfer' THEN v_destination_previous ELSE NULL END,
    'destination_new_balance', CASE WHEN p_operation = 'transfer' THEN v_destination_new ELSE NULL END
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.record_manual_inventory_movement(uuid,uuid,text,numeric,text,text,text,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.record_manual_inventory_movement(uuid,uuid,text,numeric,text,text,text,text) FROM anon;
GRANT EXECUTE ON FUNCTION public.record_manual_inventory_movement(uuid,uuid,text,numeric,text,text,text,text) TO authenticated, service_role;

-- Estoque: leitura pelo cliente; escrita somente pelos motores SECURITY DEFINER.
DROP POLICY IF EXISTS "Allow all on inventory" ON public.inventory;
DROP POLICY IF EXISTS "Authenticated can read inventory" ON public.inventory;
CREATE POLICY "Authenticated can read inventory"
ON public.inventory FOR SELECT TO authenticated
USING (true);

DROP POLICY IF EXISTS "Allow all on inventory_movements" ON public.inventory_movements;
DROP POLICY IF EXISTS "Authenticated can read inventory movements" ON public.inventory_movements;
CREATE POLICY "Authenticated can read inventory movements"
ON public.inventory_movements FOR SELECT TO authenticated
USING (true);

REVOKE ALL PRIVILEGES ON TABLE public.inventory FROM anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public.inventory_movements FROM anon, authenticated;
GRANT SELECT ON TABLE public.inventory TO authenticated;
GRANT SELECT ON TABLE public.inventory_movements TO authenticated;

-- Pedido continua editavel pelos perfis operacionais legitimos; sem anonimo nem DELETE/TRUNCATE fisico.
DROP POLICY IF EXISTS "Allow all on orders" ON public.orders;
DROP POLICY IF EXISTS "Operational users can read orders" ON public.orders;
DROP POLICY IF EXISTS "Operational users can insert orders" ON public.orders;
DROP POLICY IF EXISTS "Operational users can update orders" ON public.orders;

CREATE POLICY "Operational users can read orders"
ON public.orders FOR SELECT TO authenticated
USING (public.current_app_user_role() IN ('Administrador', 'VENDA', 'LIDER PRODUÇÃO'));

CREATE POLICY "Operational users can insert orders"
ON public.orders FOR INSERT TO authenticated
WITH CHECK (public.current_app_user_role() IN ('Administrador', 'VENDA', 'LIDER PRODUÇÃO'));

CREATE POLICY "Operational users can update orders"
ON public.orders FOR UPDATE TO authenticated
USING (public.current_app_user_role() IN ('Administrador', 'VENDA', 'LIDER PRODUÇÃO'))
WITH CHECK (public.current_app_user_role() IN ('Administrador', 'VENDA', 'LIDER PRODUÇÃO'));

REVOKE ALL PRIVILEGES ON TABLE public.orders FROM anon;
REVOKE DELETE, TRUNCATE ON TABLE public.orders FROM authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.orders TO authenticated;

-- RPCs operacionais antigas permanecem compativeis pelo nome, mas fechadas para anonimo e com gate real de papel.
ALTER FUNCTION public.import_shopee_order_with_stock(jsonb,jsonb)
  RENAME TO import_shopee_order_with_stock_unguarded_01b;
ALTER FUNCTION public.set_order_operational_status(uuid,text)
  RENAME TO set_order_operational_status_unguarded_01b;
ALTER FUNCTION public.transition_order_status_with_stock(uuid,text)
  RENAME TO transition_order_status_with_stock_unguarded_01b;
ALTER FUNCTION public.mark_order_separation_printed(uuid)
  RENAME TO mark_order_separation_printed_unguarded_01b;

REVOKE ALL ON FUNCTION public.import_shopee_order_with_stock_unguarded_01b(jsonb,jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.set_order_operational_status_unguarded_01b(uuid,text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.transition_order_status_with_stock_unguarded_01b(uuid,text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mark_order_separation_printed_unguarded_01b(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.import_shopee_order_with_stock_unguarded_01b(jsonb,jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.set_order_operational_status_unguarded_01b(uuid,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.transition_order_status_with_stock_unguarded_01b(uuid,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.mark_order_separation_printed_unguarded_01b(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.import_shopee_order_with_stock(p_order jsonb, p_items jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.role() <> 'service_role' AND COALESCE(public.current_app_user_role(), '') NOT IN ('Administrador', 'VENDA', 'LIDER PRODUÇÃO') THEN
    RAISE EXCEPTION 'operations_order_write_required';
  END IF;
  RETURN public.import_shopee_order_with_stock_unguarded_01b(p_order, p_items);
END;
$function$;

CREATE OR REPLACE FUNCTION public.set_order_operational_status(p_order_id uuid, p_status text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.role() <> 'service_role' AND COALESCE(public.current_app_user_role(), '') NOT IN ('Administrador', 'VENDA', 'LIDER PRODUÇÃO') THEN
    RAISE EXCEPTION 'operations_order_write_required';
  END IF;
  RETURN public.set_order_operational_status_unguarded_01b(p_order_id, p_status);
END;
$function$;

CREATE OR REPLACE FUNCTION public.transition_order_status_with_stock(p_order_id uuid, p_status text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.role() <> 'service_role' AND COALESCE(public.current_app_user_role(), '') NOT IN ('Administrador', 'VENDA', 'LIDER PRODUÇÃO') THEN
    RAISE EXCEPTION 'operations_order_write_required';
  END IF;
  RETURN public.transition_order_status_with_stock_unguarded_01b(p_order_id, p_status);
END;
$function$;

CREATE OR REPLACE FUNCTION public.mark_order_separation_printed(p_order_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.role() <> 'service_role' AND COALESCE(public.current_app_user_role(), '') NOT IN ('Administrador', 'VENDA', 'LIDER PRODUÇÃO') THEN
    RAISE EXCEPTION 'operations_order_write_required';
  END IF;
  RETURN public.mark_order_separation_printed_unguarded_01b(p_order_id);
END;
$function$;

REVOKE ALL ON FUNCTION public.import_shopee_order_with_stock(jsonb,jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.set_order_operational_status(uuid,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.transition_order_status_with_stock(uuid,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.mark_order_separation_printed(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.import_shopee_order_with_stock(jsonb,jsonb) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.set_order_operational_status(uuid,text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.transition_order_status_with_stock(uuid,text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.mark_order_separation_printed(uuid) TO authenticated, service_role;
