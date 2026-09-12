-- FASE 11.2: fundação transacional de Compras e Recebimento.
-- Pedido de compra e material em trânsito não alteram estoque. Somente a
-- confirmação idempotente de um recebimento cria entrada física.

CREATE TABLE public.purchase_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_contact_id uuid NOT NULL REFERENCES public.contacts(id) ON DELETE RESTRICT,
  status text NOT NULL DEFAULT 'rascunho' CHECK (status IN (
    'rascunho', 'confirmado', 'em_transito', 'parcialmente_recebido', 'recebido', 'cancelado'
  )),
  ordered_at timestamptz NULL,
  expected_at date NULL,
  notes text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.purchase_presentations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  variant_id uuid NULL REFERENCES public.product_variants(id) ON DELETE RESTRICT,
  name text NOT NULL CHECK (btrim(name) <> ''),
  purchase_unit_label text NOT NULL CHECK (btrim(purchase_unit_label) <> ''),
  stock_unit_label text NOT NULL CHECK (btrim(stock_unit_label) <> ''),
  conversion_factor numeric NOT NULL CHECK (conversion_factor > 0),
  is_approximate boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  notes text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.purchase_order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_order_id uuid NOT NULL REFERENCES public.purchase_orders(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  variant_id uuid NULL REFERENCES public.product_variants(id) ON DELETE RESTRICT,
  purchase_presentation_id uuid NULL REFERENCES public.purchase_presentations(id) ON DELETE RESTRICT,
  ordered_purchase_qty numeric NOT NULL CHECK (ordered_purchase_qty > 0),
  purchase_unit_label text NOT NULL CHECK (btrim(purchase_unit_label) <> ''),
  conversion_factor numeric NOT NULL CHECK (conversion_factor > 0),
  stock_unit_label text NOT NULL CHECK (btrim(stock_unit_label) <> ''),
  unit_price numeric NULL CHECK (unit_price IS NULL OR unit_price >= 0),
  presentation_snapshot jsonb NOT NULL CHECK (
    jsonb_typeof(presentation_snapshot) = 'object'
    AND presentation_snapshot ?& ARRAY[
      'presentation_id', 'name', 'purchase_unit_label', 'stock_unit_label', 'conversion_factor', 'is_approximate'
    ]
  ),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.purchase_receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_order_id uuid NOT NULL REFERENCES public.purchase_orders(id) ON DELETE RESTRICT,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'confirmed', 'cancelled')),
  storage_location_id uuid NOT NULL REFERENCES public.storage_locations(id) ON DELETE RESTRICT,
  received_at timestamptz NULL,
  confirmed_at timestamptz NULL,
  confirmed_by uuid NULL,
  notes text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.purchase_receipt_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_receipt_id uuid NOT NULL REFERENCES public.purchase_receipts(id) ON DELETE CASCADE,
  purchase_order_item_id uuid NOT NULL REFERENCES public.purchase_order_items(id) ON DELETE RESTRICT,
  received_purchase_qty numeric NOT NULL CHECK (received_purchase_qty > 0),
  operational_received_qty numeric NOT NULL CHECK (operational_received_qty > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT purchase_receipt_items_one_line_per_order_item UNIQUE (purchase_receipt_id, purchase_order_item_id)
);

-- A mesma identidade física usada por Estoque/BOM/Pedido é exigida em
-- apresentação de compra e item de compra. Apresentação comercial não cria
-- variante: ela apenas aponta para uma identidade já existente.
CREATE OR REPLACE FUNCTION public.assert_purchase_physical_identity()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_variation_mode text;
BEGIN
  SELECT variation_mode INTO v_variation_mode
  FROM public.products
  WHERE id = NEW.product_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Produto não encontrado para a identidade de compra.';
  END IF;

  IF COALESCE(v_variation_mode, 'sem_variacao') = 'variacoes_fisicas' AND NEW.variant_id IS NULL THEN
    RAISE EXCEPTION 'Produto Mestre exige variante física para compra e recebimento.';
  END IF;

  IF COALESCE(v_variation_mode, 'sem_variacao') <> 'variacoes_fisicas' AND NEW.variant_id IS NOT NULL THEN
    RAISE EXCEPTION 'Produto simples não aceita variante física para compra e recebimento.';
  END IF;

  IF NEW.variant_id IS NOT NULL AND NOT EXISTS (
    SELECT 1
    FROM public.product_variants variant
    WHERE variant.id = NEW.variant_id
      AND variant.product_id = NEW.product_id
  ) THEN
    RAISE EXCEPTION 'A variante informada não pertence ao produto da compra.';
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.assert_purchase_order_item_presentation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.purchase_presentation_id IS NOT NULL AND NOT EXISTS (
    SELECT 1
    FROM public.purchase_presentations presentation
    WHERE presentation.id = NEW.purchase_presentation_id
      AND presentation.product_id = NEW.product_id
      AND presentation.variant_id IS NOT DISTINCT FROM NEW.variant_id
  ) THEN
    RAISE EXCEPTION 'A apresentação de compra não pertence à identidade física do item.';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.assert_purchase_receipt_item_contract()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_receipt_order_id uuid;
  v_receipt_status text;
  v_item_order_id uuid;
  v_receipt_id uuid;
BEGIN
  v_receipt_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.purchase_receipt_id ELSE NEW.purchase_receipt_id END;

  SELECT purchase_order_id, status
  INTO v_receipt_order_id, v_receipt_status
  FROM public.purchase_receipts
  WHERE id = v_receipt_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Recebimento não encontrado.';
  END IF;
  IF v_receipt_status <> 'draft' THEN
    RAISE EXCEPTION 'Itens só podem ser alterados em recebimento rascunho.';
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;

  SELECT purchase_order_id INTO v_item_order_id
  FROM public.purchase_order_items
  WHERE id = NEW.purchase_order_item_id;

  IF NOT FOUND OR v_item_order_id IS DISTINCT FROM v_receipt_order_id THEN
    RAISE EXCEPTION 'Item de recebimento não pertence ao pedido de compra.';
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.protect_confirmed_purchase_receipt()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF OLD.status = 'confirmed' AND NEW.status <> 'confirmed' THEN
    RAISE EXCEPTION 'Recebimento confirmado não pode ser cancelado nesta versão.';
  END IF;
  IF NEW.status = 'confirmed'
     AND current_setting('app.purchase_receipt_confirmation', true) IS DISTINCT FROM 'true' THEN
    RAISE EXCEPTION 'Use confirm_purchase_receipt para confirmar o recebimento.';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.protect_received_purchase_order_item()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_item_id uuid := COALESCE(NEW.id, OLD.id);
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.purchase_receipt_items receipt_item
    JOIN public.purchase_receipts receipt ON receipt.id = receipt_item.purchase_receipt_id
    WHERE receipt_item.purchase_order_item_id = v_item_id
      AND receipt.status = 'confirmed'
  ) THEN
    RAISE EXCEPTION 'Item de compra com recebimento confirmado não pode ser alterado ou removido.';
  END IF;
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.prevent_purchase_order_cancel_after_receipt()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'cancelado' AND OLD.status <> 'cancelado' AND EXISTS (
    SELECT 1 FROM public.purchase_receipts
    WHERE purchase_order_id = OLD.id AND status = 'confirmed'
  ) THEN
    RAISE EXCEPTION 'Pedido com recebimento confirmado não pode ser cancelado nesta versão.';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER purchase_presentations_physical_identity
  BEFORE INSERT OR UPDATE OF product_id, variant_id ON public.purchase_presentations
  FOR EACH ROW EXECUTE FUNCTION public.assert_purchase_physical_identity();

CREATE TRIGGER purchase_order_items_physical_identity
  BEFORE INSERT OR UPDATE OF product_id, variant_id ON public.purchase_order_items
  FOR EACH ROW EXECUTE FUNCTION public.assert_purchase_physical_identity();

CREATE TRIGGER purchase_order_items_presentation_matches_identity
  BEFORE INSERT OR UPDATE OF product_id, variant_id, purchase_presentation_id ON public.purchase_order_items
  FOR EACH ROW EXECUTE FUNCTION public.assert_purchase_order_item_presentation();

CREATE TRIGGER purchase_receipt_items_contract
  BEFORE INSERT OR UPDATE OR DELETE ON public.purchase_receipt_items
  FOR EACH ROW EXECUTE FUNCTION public.assert_purchase_receipt_item_contract();

CREATE TRIGGER purchase_receipts_confirmation_guard
  BEFORE UPDATE ON public.purchase_receipts
  FOR EACH ROW EXECUTE FUNCTION public.protect_confirmed_purchase_receipt();

CREATE TRIGGER purchase_order_items_receipt_guard
  BEFORE UPDATE OR DELETE ON public.purchase_order_items
  FOR EACH ROW EXECUTE FUNCTION public.protect_received_purchase_order_item();

CREATE TRIGGER purchase_orders_cancel_guard
  BEFORE UPDATE OF status ON public.purchase_orders
  FOR EACH ROW EXECUTE FUNCTION public.prevent_purchase_order_cancel_after_receipt();

CREATE OR REPLACE FUNCTION public.recalculate_purchase_order_receiving_status(p_purchase_order_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order public.purchase_orders%ROWTYPE;
  v_any_received boolean := false;
  v_all_received boolean := false;
BEGIN
  SELECT * INTO v_order
  FROM public.purchase_orders
  WHERE id = p_purchase_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pedido de compra não encontrado.';
  END IF;
  IF v_order.status = 'cancelado' THEN
    RETURN v_order.status;
  END IF;

  WITH received AS (
    SELECT
      purchase_item.id,
      purchase_item.ordered_purchase_qty,
      COALESCE(sum(receipt_item.received_purchase_qty) FILTER (WHERE receipt.status = 'confirmed'), 0) AS received_purchase_qty
    FROM public.purchase_order_items purchase_item
    LEFT JOIN public.purchase_receipt_items receipt_item ON receipt_item.purchase_order_item_id = purchase_item.id
    LEFT JOIN public.purchase_receipts receipt ON receipt.id = receipt_item.purchase_receipt_id
    WHERE purchase_item.purchase_order_id = p_purchase_order_id
    GROUP BY purchase_item.id, purchase_item.ordered_purchase_qty
  )
  SELECT
    COALESCE(bool_or(received_purchase_qty > 0.000001), false),
    COALESCE(bool_and(received_purchase_qty >= ordered_purchase_qty - 0.000001), false)
  INTO v_any_received, v_all_received
  FROM received;

  IF v_all_received THEN
    UPDATE public.purchase_orders SET status = 'recebido', updated_at = now() WHERE id = p_purchase_order_id;
    RETURN 'recebido';
  END IF;
  IF v_any_received THEN
    UPDATE public.purchase_orders SET status = 'parcialmente_recebido', updated_at = now() WHERE id = p_purchase_order_id;
    RETURN 'parcialmente_recebido';
  END IF;

  RETURN v_order.status;
END;
$$;

CREATE OR REPLACE FUNCTION public.confirm_purchase_receipt(p_receipt_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_receipt public.purchase_receipts%ROWTYPE;
  v_order public.purchase_orders%ROWTYPE;
  v_location_name text;
  v_item record;
  v_previous_balance numeric;
  v_new_balance numeric;
  v_event_key text;
  v_status text;
  v_movement_count integer := 0;
BEGIN
  SELECT * INTO v_receipt
  FROM public.purchase_receipts
  WHERE id = p_receipt_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Recebimento não encontrado.';
  END IF;
  IF v_receipt.status = 'confirmed' THEN
    RETURN jsonb_build_object('receipt_id', v_receipt.id, 'already_confirmed', true, 'movement_count', 0);
  END IF;
  IF v_receipt.status = 'cancelled' THEN
    RAISE EXCEPTION 'Recebimento cancelado não pode ser confirmado.';
  END IF;

  SELECT * INTO v_order
  FROM public.purchase_orders
  WHERE id = v_receipt.purchase_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pedido de compra não encontrado.';
  END IF;
  IF v_order.status = 'cancelado' THEN
    RAISE EXCEPTION 'Pedido de compra cancelado não pode receber material.';
  END IF;
  IF v_order.status NOT IN ('confirmado', 'em_transito', 'parcialmente_recebido') THEN
    RAISE EXCEPTION 'Pedido de compra precisa estar confirmado ou em trânsito para receber material.';
  END IF;

  SELECT name INTO v_location_name
  FROM public.storage_locations
  WHERE id = v_receipt.storage_location_id
    AND is_active = true;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Local de estoque inválido ou inativo para o recebimento.';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.purchase_receipt_items WHERE purchase_receipt_id = v_receipt.id) THEN
    RAISE EXCEPTION 'Recebimento precisa ter ao menos um item.';
  END IF;

  -- Pré-valida todos os itens, inclusive excesso acumulado, antes de qualquer
  -- saldo ou movimento ser escrito. Qualquer exceção desfaz a transação toda.
  FOR v_item IN
    WITH confirmed_before AS (
      SELECT receipt_item.purchase_order_item_id, sum(receipt_item.received_purchase_qty) AS received_purchase_qty
      FROM public.purchase_receipt_items receipt_item
      JOIN public.purchase_receipts receipt ON receipt.id = receipt_item.purchase_receipt_id
      WHERE receipt.purchase_order_id = v_order.id
        AND receipt.status = 'confirmed'
      GROUP BY receipt_item.purchase_order_item_id
    )
    SELECT
      purchase_item.id AS purchase_order_item_id,
      purchase_item.product_id,
      purchase_item.variant_id,
      purchase_item.ordered_purchase_qty,
      receipt_item.received_purchase_qty,
      COALESCE(confirmed_before.received_purchase_qty, 0) AS previously_received_purchase_qty,
      receipt_item.id AS purchase_receipt_item_id,
      receipt_item.operational_received_qty
    FROM public.purchase_receipt_items receipt_item
    JOIN public.purchase_order_items purchase_item ON purchase_item.id = receipt_item.purchase_order_item_id
    LEFT JOIN confirmed_before ON confirmed_before.purchase_order_item_id = purchase_item.id
    WHERE receipt_item.purchase_receipt_id = v_receipt.id
  LOOP
    IF v_item.received_purchase_qty + v_item.previously_received_purchase_qty > v_item.ordered_purchase_qty + 0.000001 THEN
      RAISE EXCEPTION 'Recebimento excede a quantidade pedida para o item %.', v_item.purchase_order_item_id;
    END IF;

    -- Revalida no momento físico para proteger dados criados antes de um
    -- eventual ajuste cadastral e garantir Mestre + Variante obrigatória.
    IF NOT EXISTS (
      SELECT 1
      FROM public.products product
      WHERE product.id = v_item.product_id
        AND (
          (COALESCE(product.variation_mode, 'sem_variacao') = 'sem_variacao' AND v_item.variant_id IS NULL)
          OR (
            product.variation_mode = 'variacoes_fisicas'
            AND EXISTS (
              SELECT 1 FROM public.product_variants variant
              WHERE variant.id = v_item.variant_id AND variant.product_id = product.id
            )
          )
        )
    ) THEN
      RAISE EXCEPTION 'Identidade física inválida no item de recebimento %.', v_item.purchase_order_item_id;
    END IF;

    v_event_key := 'purchase_receipt:' || v_receipt.id::text || ':' || v_item.purchase_receipt_item_id::text || ':' || v_receipt.storage_location_id::text;
    IF EXISTS (SELECT 1 FROM public.inventory_movements WHERE event_key = v_event_key) THEN
      RAISE EXCEPTION 'Recebimento possui evento físico já registrado e precisa de reconciliação.';
    END IF;
  END LOOP;

  -- Todos os itens foram validados; agora cada entrada é registrada na mesma
  -- transação e vinculada ao receipt que a originou.
  FOR v_item IN
    SELECT
      receipt_item.id AS purchase_receipt_item_id,
      purchase_item.product_id,
      purchase_item.variant_id,
      receipt_item.operational_received_qty,
      purchase_item.purchase_unit_label,
      receipt_item.received_purchase_qty
    FROM public.purchase_receipt_items receipt_item
    JOIN public.purchase_order_items purchase_item ON purchase_item.id = receipt_item.purchase_order_item_id
    WHERE receipt_item.purchase_receipt_id = v_receipt.id
    ORDER BY receipt_item.id
  LOOP
    INSERT INTO public.inventory (product_id, variant_id, location, location_id, quantity, updated_at)
    VALUES (
      v_item.product_id, v_item.variant_id, v_location_name, v_receipt.storage_location_id,
      v_item.operational_received_qty, now()
    )
    ON CONFLICT (product_id, variant_id, location)
    DO UPDATE SET
      quantity = public.inventory.quantity + EXCLUDED.quantity,
      location_id = EXCLUDED.location_id,
      updated_at = now()
    RETURNING quantity - v_item.operational_received_qty, quantity
    INTO v_previous_balance, v_new_balance;

    v_event_key := 'purchase_receipt:' || v_receipt.id::text || ':' || v_item.purchase_receipt_item_id::text || ':' || v_receipt.storage_location_id::text;
    INSERT INTO public.inventory_movements (
      product_id, variant_id, movement_type, quantity, previous_balance, new_balance,
      location, reference_type, reference_id, event_key, notes
    ) VALUES (
      v_item.product_id, v_item.variant_id, 'in', v_item.operational_received_qty,
      v_previous_balance, v_new_balance,
      v_location_name, 'purchase_receipt', v_receipt.id, v_event_key,
      'Entrada por recebimento de compra: ' || v_item.received_purchase_qty || ' ' || v_item.purchase_unit_label
    );
    v_movement_count := v_movement_count + 1;
  END LOOP;

  PERFORM set_config('app.purchase_receipt_confirmation', 'true', true);
  UPDATE public.purchase_receipts
  SET status = 'confirmed',
      received_at = COALESCE(received_at, now()),
      confirmed_at = now(),
      confirmed_by = COALESCE(confirmed_by, auth.uid()),
      updated_at = now()
  WHERE id = v_receipt.id;

  v_status := public.recalculate_purchase_order_receiving_status(v_order.id);

  RETURN jsonb_build_object(
    'receipt_id', v_receipt.id,
    'purchase_order_id', v_order.id,
    'already_confirmed', false,
    'movement_count', v_movement_count,
    'purchase_order_status', v_status
  );
END;
$$;

CREATE INDEX purchase_orders_supplier_contact_id_idx ON public.purchase_orders(supplier_contact_id);
CREATE INDEX purchase_orders_status_idx ON public.purchase_orders(status);
CREATE INDEX purchase_order_items_purchase_order_id_idx ON public.purchase_order_items(purchase_order_id);
CREATE INDEX purchase_receipts_purchase_order_id_idx ON public.purchase_receipts(purchase_order_id);
CREATE INDEX purchase_receipts_status_idx ON public.purchase_receipts(status);
CREATE INDEX purchase_receipt_items_receipt_id_idx ON public.purchase_receipt_items(purchase_receipt_id);
CREATE INDEX purchase_receipt_items_order_item_id_idx ON public.purchase_receipt_items(purchase_order_item_id);
CREATE INDEX purchase_presentations_identity_idx ON public.purchase_presentations(product_id, variant_id);

ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_presentations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_receipt_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users operate purchase_orders" ON public.purchase_orders
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users operate purchase_order_items" ON public.purchase_order_items
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users operate purchase_presentations" ON public.purchase_presentations
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users operate purchase_receipts" ON public.purchase_receipts
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users operate purchase_receipt_items" ON public.purchase_receipt_items
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.purchase_orders TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.purchase_order_items TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.purchase_presentations TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.purchase_receipts TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.purchase_receipt_items TO authenticated;
REVOKE ALL ON FUNCTION public.confirm_purchase_receipt(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.confirm_purchase_receipt(uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.recalculate_purchase_order_receiving_status(uuid) FROM PUBLIC;

CREATE TRIGGER purchase_orders_updated_at
  BEFORE UPDATE ON public.purchase_orders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER purchase_order_items_updated_at
  BEFORE UPDATE ON public.purchase_order_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER purchase_presentations_updated_at
  BEFORE UPDATE ON public.purchase_presentations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER purchase_receipts_updated_at
  BEFORE UPDATE ON public.purchase_receipts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER purchase_receipt_items_updated_at
  BEFORE UPDATE ON public.purchase_receipt_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
