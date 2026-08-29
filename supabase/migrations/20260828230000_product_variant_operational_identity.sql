-- FASE 4.6: identidade física opcional para produtos com variantes.
-- product_id continua sendo o produto mestre; variant_id é aditivo e nulo
-- para produtos simples e para todo o histórico já existente.

ALTER TABLE public.inventory
  ADD COLUMN IF NOT EXISTS variant_id uuid NULL REFERENCES public.product_variants(id) ON DELETE RESTRICT;

ALTER TABLE public.inventory_movements
  ADD COLUMN IF NOT EXISTS variant_id uuid NULL REFERENCES public.product_variants(id) ON DELETE RESTRICT;

ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS variant_id uuid NULL REFERENCES public.product_variants(id) ON DELETE RESTRICT;

ALTER TABLE public.marketplace_product_mappings
  ADD COLUMN IF NOT EXISTS variant_id uuid NULL REFERENCES public.product_variants(id) ON DELETE RESTRICT;

-- A variante, quando presente, deve sempre pertencer ao mesmo produto mestre.
CREATE OR REPLACE FUNCTION public.assert_variant_matches_product()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.variant_id IS NOT NULL AND NOT EXISTS (
    SELECT 1
    FROM public.product_variants variant
    WHERE variant.id = NEW.variant_id
      AND variant.product_id = NEW.product_id
  ) THEN
    RAISE EXCEPTION 'A variante % não pertence ao produto mestre %.', NEW.variant_id, NEW.product_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS inventory_variant_matches_product ON public.inventory;
CREATE TRIGGER inventory_variant_matches_product
  BEFORE INSERT OR UPDATE OF product_id, variant_id ON public.inventory
  FOR EACH ROW EXECUTE FUNCTION public.assert_variant_matches_product();

DROP TRIGGER IF EXISTS inventory_movement_variant_matches_product ON public.inventory_movements;
CREATE TRIGGER inventory_movement_variant_matches_product
  BEFORE INSERT OR UPDATE OF product_id, variant_id ON public.inventory_movements
  FOR EACH ROW EXECUTE FUNCTION public.assert_variant_matches_product();

DROP TRIGGER IF EXISTS order_item_variant_matches_product ON public.order_items;
CREATE TRIGGER order_item_variant_matches_product
  BEFORE INSERT OR UPDATE OF product_id, variant_id ON public.order_items
  FOR EACH ROW EXECUTE FUNCTION public.assert_variant_matches_product();

DROP TRIGGER IF EXISTS marketplace_mapping_variant_matches_product ON public.marketplace_product_mappings;
CREATE TRIGGER marketplace_mapping_variant_matches_product
  BEFORE INSERT OR UPDATE OF product_id, variant_id ON public.marketplace_product_mappings
  FOR EACH ROW EXECUTE FUNCTION public.assert_variant_matches_product();

-- UNIQUE com NULLS NOT DISTINCT trata produto simples (variant_id NULL) como
-- uma identidade de estoque única por local e mantém independência por variante.
ALTER TABLE public.inventory DROP CONSTRAINT IF EXISTS inventory_product_location_unique;
ALTER TABLE public.inventory DROP CONSTRAINT IF EXISTS inventory_product_id_location_key;
ALTER TABLE public.inventory DROP CONSTRAINT IF EXISTS inventory_product_variant_location_unique;
ALTER TABLE public.inventory
  ADD CONSTRAINT inventory_product_variant_location_unique
  UNIQUE NULLS NOT DISTINCT (product_id, variant_id, location);

CREATE INDEX IF NOT EXISTS inventory_variant_id_idx ON public.inventory(variant_id) WHERE variant_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS inventory_movements_variant_id_idx ON public.inventory_movements(variant_id) WHERE variant_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS order_items_variant_id_idx ON public.order_items(variant_id) WHERE variant_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS marketplace_product_mappings_variant_id_idx ON public.marketplace_product_mappings(variant_id) WHERE variant_id IS NOT NULL;

-- OP-01 continua sendo o único responsável pela baixa física. A diferença é
-- que, quando o item possui variante, valida e movimenta apenas aquele saldo.
CREATE OR REPLACE FUNCTION public.apply_order_stock_event(
  p_order_id uuid,
  p_event text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item record;
  v_inventory record;
  v_available numeric;
  v_remaining numeric;
  v_take numeric;
  v_event text;
  v_key text;
  v_movement_count integer := 0;
BEGIN
  IF p_event NOT IN ('confirmed', 'cancelled', 'shipped', 'external_shipped') THEN
    RAISE EXCEPTION 'Evento de estoque de pedido inválido: %', p_event;
  END IF;

  PERFORM 1 FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Pedido não encontrado'; END IF;
  IF p_event IN ('confirmed', 'cancelled') THEN
    RETURN jsonb_build_object('event', p_event, 'applied', false, 'already_applied', false, 'movement_count', 0);
  END IF;

  v_event := 'physical_out';
  IF EXISTS (
    SELECT 1 FROM public.inventory_movements
    WHERE reference_id = p_order_id AND movement_type = 'out'
      AND (reference_type = 'order' OR (reference_type = 'order_stock_event' AND event_key LIKE 'order:' || p_order_id::text || ':' || v_event || ':%'))
  ) THEN
    RETURN jsonb_build_object('event', p_event, 'applied', false, 'already_applied', true, 'movement_count', 0);
  END IF;

  FOR v_item IN
    SELECT product_id, variant_id, sum(quantity) AS quantity
    FROM public.order_items WHERE order_id = p_order_id
    GROUP BY product_id, variant_id
  LOOP
    v_available := 0;
    FOR v_inventory IN
      SELECT quantity FROM public.inventory
      WHERE product_id = v_item.product_id
        AND variant_id IS NOT DISTINCT FROM v_item.variant_id
      FOR UPDATE
    LOOP v_available := v_available + v_inventory.quantity; END LOOP;
    IF v_available < v_item.quantity THEN
      RAISE EXCEPTION 'Estoque insuficiente para expedir produto % variante % do pedido', v_item.product_id, COALESCE(v_item.variant_id::text, 'simples');
    END IF;
  END LOOP;

  FOR v_item IN SELECT id, product_id, variant_id, quantity FROM public.order_items WHERE order_id = p_order_id LOOP
    v_remaining := v_item.quantity;
    FOR v_inventory IN
      SELECT id, location, quantity FROM public.inventory
      WHERE product_id = v_item.product_id
        AND variant_id IS NOT DISTINCT FROM v_item.variant_id
        AND quantity > 0
      ORDER BY quantity DESC, id FOR UPDATE
    LOOP
      EXIT WHEN v_remaining <= 0;
      v_take := LEAST(v_remaining, v_inventory.quantity);
      v_key := 'order:' || p_order_id::text || ':' || v_event || ':' || v_item.id::text || ':' || COALESCE(v_inventory.location, 'sem-localizacao');
      UPDATE public.inventory SET quantity = quantity - v_take, updated_at = now() WHERE id = v_inventory.id;
      INSERT INTO public.inventory_movements (
        product_id, variant_id, movement_type, quantity, previous_balance, new_balance,
        location, reference_type, reference_id, event_key, notes
      ) VALUES (
        v_item.product_id, v_item.variant_id, 'out', v_take, v_inventory.quantity, v_inventory.quantity - v_take,
        v_inventory.location, 'order_stock_event', p_order_id, v_key, 'Saída física por expedição de pedido'
      );
      v_remaining := v_remaining - v_take;
      v_movement_count := v_movement_count + 1;
    END LOOP;
  END LOOP;
  RETURN jsonb_build_object('event', p_event, 'applied', true, 'already_applied', false, 'movement_count', v_movement_count);
END;
$$;

-- Motor único de venda: recebe variant_id opcional e preserva a ausência
-- legítima de variante para todos os itens simples/legados.
CREATE OR REPLACE FUNCTION public.create_unified_sale(p_order jsonb, p_items jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order orders%ROWTYPE;
  v_item jsonb;
  v_total numeric := 0;
  v_subtotal numeric := 0;
  v_discount numeric := GREATEST(COALESCE((p_order->>'discount_amount')::numeric, 0), 0);
  v_shipping numeric := GREATEST(COALESCE((p_order->>'shipping_amount')::numeric, 0), 0);
  v_financial_id uuid;
  v_category_id uuid;
  v_payment_status text := COALESCE(NULLIF(p_order->>'payment_status', ''), 'pendente');
  v_financial_due date := COALESCE(NULLIF(p_order->>'financial_due_date', '')::date, current_date);
  v_sale_origin text := COALESCE(NULLIF(btrim(p_order->>'sale_origin'), ''), 'operacoes');
  v_sale_request_key uuid := NULLIF(btrim(p_order->>'sale_request_key'), '')::uuid;
  v_crm_order_confirmed boolean := COALESCE((p_order->>'crm_order_confirmed')::boolean, false);
BEGIN
  IF jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN RAISE EXCEPTION 'Adicione ao menos um produto à venda.'; END IF;
  IF v_payment_status NOT IN ('pendente', 'pago', 'parcial') THEN RAISE EXCEPTION 'Situação financeira inválida.'; END IF;
  IF v_sale_request_key IS NOT NULL THEN
    PERFORM pg_advisory_xact_lock(hashtext('unified-sale:' || v_sale_request_key::text));
    SELECT * INTO v_order FROM public.orders WHERE sale_request_key = v_sale_request_key LIMIT 1;
    IF FOUND THEN
      SELECT id INTO v_financial_id FROM public.financial_entries WHERE order_id = v_order.id AND type = 'receber' ORDER BY created_at LIMIT 1;
      RETURN jsonb_build_object('order_id', v_order.id, 'order_number', v_order.order_number, 'financial_entry_id', v_financial_id, 'total_value', v_order.total_value, 'already_registered', true);
    END IF;
  END IF;
  SELECT COALESCE(sum(GREATEST(COALESCE((x->>'quantity')::numeric, 0), 0) * GREATEST(COALESCE((x->>'unit_price')::numeric, 0), 0)), 0) INTO v_subtotal FROM jsonb_array_elements(p_items) x;
  v_total := GREATEST(v_subtotal - v_discount + v_shipping, 0);
  IF v_total <= 0 THEN RAISE EXCEPTION 'O total da venda deve ser maior que zero.'; END IF;
  IF v_payment_status = 'pago' AND NULLIF(p_order->>'financial_account_id', '') IS NULL THEN RAISE EXCEPTION 'Selecione a conta que recebeu o pagamento.'; END IF;
  INSERT INTO public.orders (order_number, customer_name, customer_contact, contact_id, channel, status, total_value, order_date, due_date, delivery_date, financial_due_date, notes, order_type, payment_status, payment_method, financial_account_id, discount_amount, shipping_amount, marketplace_account, channel_account_id, sale_origin, sale_request_key)
  VALUES (COALESCE(NULLIF(p_order->>'order_number', ''), 'PED-' || floor(extract(epoch FROM clock_timestamp()) * 1000)::bigint), NULLIF(p_order->>'customer_name', ''), NULLIF(p_order->>'customer_contact', ''), NULLIF(p_order->>'contact_id', '')::uuid, COALESCE(NULLIF(p_order->>'channel', ''), 'direto'), 'pendente', v_total, COALESCE(NULLIF(p_order->>'order_date', '')::date, current_date), NULLIF(p_order->>'delivery_date', '')::date, NULLIF(p_order->>'delivery_date', '')::date, v_financial_due, NULLIF(p_order->>'notes', ''), COALESCE(NULLIF(p_order->>'order_type', ''), 'production'), v_payment_status, NULLIF(p_order->>'payment_method', ''), NULLIF(p_order->>'financial_account_id', '')::uuid, v_discount, v_shipping, NULLIF(p_order->>'marketplace_account', ''), NULLIF(p_order->>'channel_account_id', '')::uuid, v_sale_origin, v_sale_request_key)
  RETURNING * INTO v_order;
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    IF NULLIF(v_item->>'product_id', '') IS NULL OR COALESCE((v_item->>'quantity')::numeric, 0) <= 0 THEN RAISE EXCEPTION 'Produto ou quantidade inválida.'; END IF;
    INSERT INTO public.order_items(order_id, product_id, variant_id, quantity, unit_price, notes)
    VALUES (v_order.id, (v_item->>'product_id')::uuid, NULLIF(v_item->>'variant_id', '')::uuid, (v_item->>'quantity')::numeric, COALESCE((v_item->>'unit_price')::numeric, 0), NULLIF(v_item->>'notes', ''));
  END LOOP;
  SELECT id INTO v_category_id FROM public.financial_categories WHERE is_active = true AND type IN ('receber', 'ambos') AND lower(name) IN ('venda de produtos', 'vendas') ORDER BY CASE WHEN lower(name) = 'venda de produtos' THEN 0 ELSE 1 END LIMIT 1;
  INSERT INTO public.financial_entries (type, description, value, due_date, original_due_date, competence_date, order_id, contact_id, category_id, account_id, payment_method, sales_channel, marketplace_account, notes)
  VALUES ('receber', 'Pedido ' || v_order.order_number || ' - ' || COALESCE(v_order.customer_name, 'Cliente'), v_total, v_financial_due, v_financial_due, v_order.order_date, v_order.id, v_order.contact_id, v_category_id, v_order.financial_account_id, v_order.payment_method, v_order.channel, v_order.marketplace_account, 'Gerado automaticamente pelo fluxo unificado de venda') RETURNING id INTO v_financial_id;
  IF v_payment_status = 'pago' THEN INSERT INTO public.financial_movements(entry_id, account_id, value, movement_date, notes) VALUES (v_financial_id, v_order.financial_account_id, v_total, COALESCE(NULLIF(p_order->>'payment_date', '')::date, current_date), 'Recebimento registrado na venda'); END IF;
  IF v_crm_order_confirmed AND v_order.contact_id IS NOT NULL THEN
    UPDATE public.contacts SET funnel_status = 'fechado', updated_at = now() WHERE id = v_order.contact_id;
    INSERT INTO public.contact_history (contact_id, event_type, interaction_type, event_code, description, interaction_date, event_metadata)
    VALUES (v_order.contact_id, 'sale_won', 'venda', 'sale_won', 'Venda registrada — pedido ' || v_order.order_number || ' · resultado CRM-RES-021', now(), jsonb_build_object('result_code', 'CRM-RES-021', 'order_id', v_order.id, 'sale_origin', v_sale_origin));
  END IF;
  RETURN jsonb_build_object('order_id', v_order.id, 'order_number', v_order.order_number, 'financial_entry_id', v_financial_id, 'total_value', v_total, 'already_registered', false);
END;
$$;

-- Shopee preserva produto simples e encaminha a variante mapeada quando houver.
CREATE OR REPLACE FUNCTION public.import_shopee_order_with_stock(p_order jsonb, p_items jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order orders%ROWTYPE; v_item jsonb; v_external_order_id text := NULLIF(trim(p_order->>'external_order_id'), '');
  v_channel_account_id uuid := NULLIF(trim(p_order->>'channel_account_id'), '')::uuid; v_requested_account text := NULLIF(trim(p_order->>'marketplace_account'), ''); v_account text;
  v_total numeric := GREATEST(COALESCE((p_order->>'commercial_total')::numeric, 0), 0); v_items_total numeric := 0; v_stock_result jsonb; v_existing_id uuid;
  v_contact_id uuid; v_contact_matches uuid[]; v_document_raw text := COALESCE(p_order->>'document', ''); v_phone_raw text := COALESCE(p_order->>'customer_contact', ''); v_recipient_name text := NULLIF(trim(p_order->>'customer_name'), ''); v_document text; v_phone text;
BEGIN
  IF v_external_order_id IS NULL THEN RAISE EXCEPTION 'ID externo é obrigatório.'; END IF;
  IF v_channel_account_id IS NULL AND v_requested_account IS NOT NULL THEN
    SELECT ca.id, ca.name INTO v_channel_account_id, v_account FROM public.channel_accounts ca JOIN public.digital_platforms dp ON dp.id = ca.platform_id WHERE ca.is_active AND dp.is_active AND dp.group_type = 'marketplace' AND dp.parent_id IS NULL AND lower(dp.name) LIKE 'shopee%' AND lower(btrim(ca.name)) = lower(btrim(v_requested_account));
  ELSE
    SELECT ca.name INTO v_account FROM public.channel_accounts ca JOIN public.digital_platforms dp ON dp.id = ca.platform_id WHERE ca.id = v_channel_account_id AND ca.is_active AND dp.is_active AND dp.group_type = 'marketplace' AND dp.parent_id IS NULL AND lower(dp.name) LIKE 'shopee%';
  END IF;
  IF v_account IS NULL THEN RAISE EXCEPTION 'Conta Shopee não cadastrada ou inativa na fonte canônica.'; END IF;
  IF jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN RAISE EXCEPTION 'O pedido Shopee precisa ter ao menos um item.'; END IF;
  PERFORM pg_advisory_xact_lock(hashtext('shopee:' || v_account || ':' || v_external_order_id));
  SELECT id INTO v_existing_id FROM public.orders WHERE order_number = v_external_order_id AND channel = 'shopee' AND lower(btrim(COALESCE(marketplace_account, ''))) = lower(btrim(v_account)) AND deleted_at IS NULL LIMIT 1;
  IF v_existing_id IS NOT NULL THEN RETURN jsonb_build_object('order_id', v_existing_id, 'already_imported', true, 'movement_count', 0); END IF;
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    IF NULLIF(v_item->>'product_id', '') IS NULL OR COALESCE((v_item->>'quantity')::numeric, 0) <= 0 OR COALESCE((v_item->>'physical_multiplier')::numeric, 0) <= 0 THEN RAISE EXCEPTION 'Item Shopee sem produto mestre, quantidade ou multiplicador válidos.'; END IF;
    v_items_total := v_items_total + GREATEST(COALESCE((v_item->>'commercial_quantity')::numeric, 0), 0) * GREATEST(COALESCE((v_item->>'unit_price')::numeric, 0), 0);
  END LOOP;
  IF v_total = 0 THEN v_total := v_items_total; END IF;
  v_document := regexp_replace(v_document_raw, '\D', '', 'g');
  IF position('*' IN v_document_raw) = 0 AND length(v_document) >= 11 THEN SELECT array_agg(id) INTO v_contact_matches FROM (SELECT id FROM public.contacts WHERE regexp_replace(COALESCE(document, ''), '\D', '', 'g') = v_document LIMIT 2) matches; IF COALESCE(array_length(v_contact_matches, 1), 0) = 1 THEN v_contact_id := v_contact_matches[1]; END IF; END IF;
  IF v_contact_id IS NULL THEN v_phone := regexp_replace(v_phone_raw, '\D', '', 'g'); IF position('*' IN v_phone_raw) = 0 AND length(v_phone) >= 10 THEN SELECT array_agg(id) INTO v_contact_matches FROM (SELECT id FROM public.contacts WHERE phone_normalized = v_phone LIMIT 2) matches; IF COALESCE(array_length(v_contact_matches, 1), 0) = 1 THEN v_contact_id := v_contact_matches[1]; END IF; END IF; END IF;
  IF v_contact_id IS NULL AND v_recipient_name IS NOT NULL THEN INSERT INTO public.contacts (name, type, funnel_status, document, phone, whatsapp) VALUES (v_recipient_name, 'cliente', NULL, CASE WHEN position('*' IN v_document_raw) = 0 AND length(v_document) >= 11 THEN v_document ELSE NULL END, CASE WHEN position('*' IN v_phone_raw) = 0 AND length(v_phone) >= 10 THEN v_phone ELSE NULL END, CASE WHEN position('*' IN v_phone_raw) = 0 AND length(v_phone) >= 10 THEN v_phone ELSE NULL END) RETURNING id INTO v_contact_id; END IF;
  INSERT INTO public.orders (order_number, customer_name, customer_contact, contact_id, channel, channel_account_id, marketplace_account, status, total_value, order_date, due_date, delivery_date, discount_amount, shipping_amount, notes, order_type, delivery_snapshot, marketplace_metadata)
  VALUES (v_external_order_id, COALESCE(v_recipient_name, NULLIF(p_order->>'buyer_username', '')), NULLIF(v_phone_raw, ''), v_contact_id, 'shopee', v_channel_account_id, v_account, 'enviado', v_total, COALESCE(NULLIF(left(p_order->>'order_date', 10), '')::date, current_date), COALESCE(NULLIF(left(p_order->>'shipping_at', 10), '')::date, NULLIF(left(p_order->>'order_date', 10), '')::date, current_date), NULLIF(left(p_order->>'shipping_at', 10), '')::date, GREATEST(COALESCE((p_order->>'seller_discount')::numeric, 0), 0), GREATEST(COALESCE((p_order->>'shipping_fee')::numeric, 0), 0), 'Importado via XLSX Shopee.', 'stock', jsonb_strip_nulls(jsonb_build_object('recipient_name', v_recipient_name, 'document', NULLIF(v_document_raw, ''), 'phone', NULLIF(v_phone_raw, ''), 'address', NULLIF(p_order->>'address', ''), 'number', NULLIF(p_order->>'address_number', ''), 'complement', NULLIF(p_order->>'address_complement', ''), 'neighborhood', NULLIF(p_order->>'neighborhood', ''), 'city', NULLIF(p_order->>'city', ''), 'state', NULLIF(p_order->>'state', ''), 'zip_code', NULLIF(p_order->>'zip_code', ''))), jsonb_strip_nulls(jsonb_build_object('marketplace', 'shopee', 'account', v_account, 'external_status', NULLIF(p_order->>'external_status', ''), 'tracking_number', NULLIF(p_order->>'tracking_number', ''), 'buyer_username', NULLIF(p_order->>'buyer_username', ''), 'paid_at', NULLIF(p_order->>'paid_at', ''), 'shipping_at', NULLIF(p_order->>'shipping_at', '')))) RETURNING * INTO v_order;
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    INSERT INTO public.order_items (order_id, product_id, variant_id, quantity, unit_price, notes)
    VALUES (v_order.id, (v_item->>'product_id')::uuid, NULLIF(v_item->>'variant_id', '')::uuid, (v_item->>'quantity')::numeric, COALESCE((v_item->>'unit_price')::numeric, 0), concat_ws(' | ', 'Shopee comercial: ' || COALESCE(v_item->>'commercial_quantity', '0'), 'Multiplicador físico: ' || COALESCE(v_item->>'physical_multiplier', '0'), NULLIF(v_item->>'external_item_key', ''), NULLIF(v_item->>'variation', ''), NULLIF(v_item->>'product_title', '')));
  END LOOP;
  v_stock_result := public.apply_order_stock_event(v_order.id, 'external_shipped');
  RETURN jsonb_build_object('order_id', v_order.id, 'already_imported', false, 'movement_count', COALESCE((v_stock_result->>'movement_count')::integer, 0), 'contact_id', v_contact_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.apply_order_stock_event(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_unified_sale(jsonb, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.import_shopee_order_with_stock(jsonb, jsonb) TO authenticated;
