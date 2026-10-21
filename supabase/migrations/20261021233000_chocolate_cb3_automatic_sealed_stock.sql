-- Chocolate Base CB3: stock of original sealed 20kg bags per COVERAGE and LOCATION.
-- All historical inventory grams, original variant IDs, product BOMs, orders and Shopee mappings remain untouched.
-- From activation, purchase receipts for supplier 20kg presentation create sealed bags only;
-- ordinary production automatically converts only shortages to grams with audit and locks.
CREATE TABLE IF NOT EXISTS public.chocolate_sealed_stock (
 variant_id uuid NOT NULL REFERENCES public.product_variants(id),
 storage_location_id uuid NOT NULL REFERENCES public.storage_locations(id),
 sacks integer NOT NULL DEFAULT 0 CHECK (sacks >= 0),
 updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(variant_id,storage_location_id),
 CONSTRAINT cb3_allowed_cover CHECK (variant_id IN ('f6588f52-6e28-4ce9-b492-a95c847d5c0c'::uuid,'1a3d59a6-4712-4afd-811a-5a72aad76fa9'::uuid))
);
CREATE TABLE IF NOT EXISTS public.chocolate_sealed_events (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 event_key text NOT NULL UNIQUE,
 variant_id uuid NOT NULL REFERENCES public.product_variants(id),
 storage_location_id uuid NOT NULL REFERENCES public.storage_locations(id),
 movement_type text NOT NULL CHECK(movement_type IN ('in','out')),
 sacks integer NOT NULL CHECK(sacks>0),
 previous_balance integer NOT NULL,
 new_balance integer NOT NULL CHECK(new_balance>=0),
 reference_type text NOT NULL,
 reference_id uuid,
 notes text,
 created_by uuid,
 created_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT cb3_event_cover CHECK (variant_id IN ('f6588f52-6e28-4ce9-b492-a95c847d5c0c'::uuid,'1a3d59a6-4712-4afd-811a-5a72aad76fa9'::uuid))
);
CREATE INDEX IF NOT EXISTS idx_cb3_events_reference ON public.chocolate_sealed_events(reference_type,reference_id);
ALTER TABLE public.chocolate_sealed_stock ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chocolate_sealed_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS cb3_stock_read ON public.chocolate_sealed_stock;
DROP POLICY IF EXISTS cb3_events_read ON public.chocolate_sealed_events;
CREATE POLICY cb3_stock_read ON public.chocolate_sealed_stock FOR SELECT TO authenticated USING ((SELECT auth.uid()) IS NOT NULL);
CREATE POLICY cb3_events_read ON public.chocolate_sealed_events FOR SELECT TO authenticated USING ((SELECT auth.uid()) IS NOT NULL);
REVOKE ALL ON public.chocolate_sealed_stock,public.chocolate_sealed_events FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.chocolate_sealed_stock,public.chocolate_sealed_events TO authenticated;

CREATE OR REPLACE FUNCTION public.chocolate_move_sealed_internal(
 p_variant_id uuid,p_location_id uuid,p_delta integer,
 p_ref_type text,p_ref_id uuid,p_event_key text,p_notes text
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $cb3$
DECLARE v_old integer;v_new integer;
BEGIN
 IF p_variant_id NOT IN ('f6588f52-6e28-4ce9-b492-a95c847d5c0c'::uuid,'1a3d59a6-4712-4afd-811a-5a72aad76fa9'::uuid) OR p_delta IS NULL OR p_delta=0 OR abs(p_delta)>10000
 THEN RAISE EXCEPTION 'invalid_cb3_cover_or_quantity'; END IF;
 IF nullif(btrim(p_event_key),'') IS NULL THEN RAISE EXCEPTION 'cb3_event_key_required'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.storage_locations WHERE id=p_location_id AND is_active) THEN RAISE EXCEPTION 'cb3_location_invalid';END IF;
 INSERT INTO public.chocolate_sealed_stock(variant_id,storage_location_id,sacks)
 VALUES(p_variant_id,p_location_id,0) ON CONFLICT(variant_id,storage_location_id) DO NOTHING;
 SELECT sacks INTO v_old FROM public.chocolate_sealed_stock
 WHERE variant_id=p_variant_id AND storage_location_id=p_location_id FOR UPDATE;
 IF EXISTS(SELECT 1 FROM public.chocolate_sealed_events WHERE event_key=p_event_key)
 THEN RAISE EXCEPTION 'cb3_event_already_applied';END IF;
 v_new:=v_old+p_delta;
 IF v_new<0 THEN RAISE EXCEPTION 'cb3_insufficient_sealed_sacks: needed %, available %',-p_delta,v_old;END IF;
 UPDATE public.chocolate_sealed_stock SET sacks=v_new,updated_at=now()
 WHERE variant_id=p_variant_id AND storage_location_id=p_location_id;
 INSERT INTO public.chocolate_sealed_events(
 event_key,variant_id,storage_location_id,movement_type,sacks,previous_balance,new_balance,
 reference_type,reference_id,notes,created_by
 ) VALUES(p_event_key,p_variant_id,p_location_id,CASE WHEN p_delta>0 THEN 'in' ELSE 'out' END,
 abs(p_delta),v_old,v_new,p_ref_type,p_ref_id,p_notes,auth.uid());
END;$cb3$;
REVOKE ALL ON FUNCTION public.chocolate_move_sealed_internal(uuid,uuid,integer,text,uuid,text,text) FROM PUBLIC,anon,authenticated;

-- No operator UI required: called ONLY by normal production registration/reconciliation/legacy completion.
-- Uses current grams first; if missing, releases the minimum number of WHOLE original 20kg sacks.
CREATE OR REPLACE FUNCTION public.ensure_chocolate_production_material(
 p_reference_id uuid,p_variant_id uuid,p_required_g numeric,p_ref_type text DEFAULT 'production_fact'
) RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $cb3$
DECLARE v_location_id uuid;v_location text:='Fábrica';v_open numeric;v_short numeric;
 v_remaining integer;v_take integer;v_pack record;v_old numeric;v_new numeric;
 v_event uuid:=gen_random_uuid();v_moved integer:=0;v_key text;
BEGIN
 IF p_reference_id IS NULL OR p_variant_id NOT IN ('f6588f52-6e28-4ce9-b492-a95c847d5c0c'::uuid,'1a3d59a6-4712-4afd-811a-5a72aad76fa9'::uuid)
 OR p_required_g IS NULL OR p_required_g<0 OR p_ref_type NOT IN ('production_fact','production_order')
 THEN RAISE EXCEPTION 'cb3_invalid_production_request';END IF;
 IF p_ref_type='production_fact' AND NOT EXISTS(SELECT 1 FROM public.production_facts WHERE id=p_reference_id)
 THEN RAISE EXCEPTION 'cb3_missing_production_fact';END IF;
 IF p_ref_type='production_order' AND NOT EXISTS(SELECT 1 FROM public.production_orders WHERE id=p_reference_id)
 THEN RAISE EXCEPTION 'cb3_missing_production_order';END IF;
 SELECT id INTO v_location_id FROM public.storage_locations WHERE name=v_location AND is_active LIMIT 1;
 IF v_location_id IS NULL THEN RAISE EXCEPTION 'cb3_factory_location_missing';END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('cb3:production:'||p_variant_id::text,0));
 SELECT coalesce(sum(quantity),0) INTO v_open FROM public.inventory
 WHERE product_id='c70dd4b4-bc59-4d88-81ef-1a8c47315560'::uuid AND variant_id=p_variant_id AND location=v_location;
 v_short:=greatest(0,p_required_g-v_open);
 IF v_short<=0 THEN RETURN 0;END IF;
 v_remaining:=ceil(v_short/20000)::integer;
 FOR v_pack IN
  SELECT storage_location_id,sacks FROM public.chocolate_sealed_stock
  WHERE variant_id=p_variant_id AND sacks>0
  ORDER BY CASE WHEN storage_location_id=v_location_id THEN 0 ELSE 1 END,storage_location_id
  FOR UPDATE
 LOOP
  EXIT WHEN v_remaining<=0;
  v_take:=least(v_remaining,v_pack.sacks);
  IF v_take<=0 THEN CONTINUE;END IF;
  v_key:='cb3:auto_open:'||p_ref_type||':'||p_reference_id::text||':'||p_variant_id::text||':'||v_event::text||':'||v_pack.storage_location_id::text;
  PERFORM public.chocolate_move_sealed_internal(p_variant_id,v_pack.storage_location_id,-v_take,
   'chocolate_auto_open',p_reference_id,v_key||':sealed','Liberação automática de embalagem original para produção');
  INSERT INTO public.inventory(product_id,variant_id,location,location_id,quantity,updated_at)
  VALUES('c70dd4b4-bc59-4d88-81ef-1a8c47315560'::uuid,p_variant_id,v_location,v_location_id,v_take*20000,now())
  ON CONFLICT(product_id,variant_id,location)
  DO UPDATE SET quantity=public.inventory.quantity+EXCLUDED.quantity,updated_at=now()
  RETURNING quantity-v_take*20000,quantity INTO v_old,v_new;
  INSERT INTO public.inventory_movements(product_id,variant_id,movement_type,quantity,previous_balance,
  new_balance,location,reference_type,reference_id,event_key,notes)
  VALUES('c70dd4b4-bc59-4d88-81ef-1a8c47315560'::uuid,p_variant_id,'in',v_take*20000,v_old,v_new,v_location,
   'chocolate_auto_open',p_reference_id,v_key||':grams','Liberação automática dos gramas do chocolate para produção');
  v_moved:=v_moved+v_take;v_remaining:=v_remaining-v_take;
 END LOOP;
 RETURN v_moved;
END;$cb3$;
REVOKE ALL ON FUNCTION public.ensure_chocolate_production_material(uuid,uuid,numeric,text) FROM PUBLIC,anon,authenticated;

-- Commercial identity: sale of 1 sealed bag is 1 physical bag, never 20000 grams already opened.
INSERT INTO public.commercial_presentations(id,product_id,variant_id,name,commercial_unit_label,conversion_factor,composition_mode,is_active,notes)
VALUES
('c8b30000-0000-4000-8000-000000000001'::uuid,'c70dd4b4-bc59-4d88-81ef-1a8c47315560'::uuid,'f6588f52-6e28-4ce9-b492-a95c847d5c0c'::uuid,'Saco original fechado 20 kg','saco',1,'single',true,
'CB3 Branco: 1 apresentação = 1 embalagem física lacrada de 20 kg; venda por saco, preço comercial deve ser informado.'),
('c8b30000-0000-4000-8000-000000000002'::uuid,'c70dd4b4-bc59-4d88-81ef-1a8c47315560'::uuid,'1a3d59a6-4712-4afd-811a-5a72aad76fa9'::uuid,'Saco original fechado 20 kg','saco',1,'single',true,
'CB3 Meio Amargo: 1 apresentação = 1 embalagem física lacrada de 20 kg; venda por saco, preço comercial deve ser informado.')
ON CONFLICT(id) DO NOTHING;
DO $cb3$ BEGIN
 IF (SELECT count(*) FROM public.commercial_presentations WHERE
 (id='c8b30000-0000-4000-8000-000000000001'::uuid AND variant_id='f6588f52-6e28-4ce9-b492-a95c847d5c0c'::uuid OR id='c8b30000-0000-4000-8000-000000000002'::uuid AND variant_id='1a3d59a6-4712-4afd-811a-5a72aad76fa9'::uuid)
 AND product_id='c70dd4b4-bc59-4d88-81ef-1a8c47315560'::uuid AND conversion_factor=1 AND composition_mode='single' AND is_active)=2
 THEN NULL; ELSE RAISE EXCEPTION 'cb3_commercial_identity_mismatch';END IF;
END;$cb3$;


CREATE OR REPLACE FUNCTION public.confirm_purchase_receipt_unguarded_01b(p_receipt_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
  SELECT * INTO v_receipt FROM public.purchase_receipts WHERE id = p_receipt_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Recebimento não encontrado.'; END IF;
  IF v_receipt.status = 'confirmed' THEN
    RETURN jsonb_build_object('receipt_id', v_receipt.id, 'already_confirmed', true, 'movement_count', 0);
  END IF;
  IF v_receipt.status = 'cancelled' THEN RAISE EXCEPTION 'Recebimento cancelado não pode ser confirmado.'; END IF;

  SELECT * INTO v_order FROM public.purchase_orders WHERE id = v_receipt.purchase_order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Pedido de compra não encontrado.'; END IF;
  IF v_order.status = 'cancelado' THEN RAISE EXCEPTION 'Pedido de compra cancelado não pode receber material.'; END IF;
  IF v_order.status NOT IN ('confirmado', 'em_transito', 'parcialmente_recebido') THEN
    RAISE EXCEPTION 'Pedido de compra precisa estar confirmado ou em trânsito para receber material.';
  END IF;

  SELECT name INTO v_location_name FROM public.storage_locations WHERE id = v_receipt.storage_location_id AND is_active = true;
  IF NOT FOUND THEN RAISE EXCEPTION 'Local de estoque inválido ou inativo para o recebimento.'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.purchase_receipt_items WHERE purchase_receipt_id = v_receipt.id) THEN
    RAISE EXCEPTION 'Recebimento precisa ter ao menos um item.';
  END IF;

  FOR v_item IN
    SELECT purchase_item.id AS purchase_order_item_id, purchase_item.product_id,
      purchase_item.variant_id, receipt_item.id AS purchase_receipt_item_id,
      receipt_item.operational_received_qty
    FROM public.purchase_receipt_items receipt_item
    JOIN public.purchase_order_items purchase_item ON purchase_item.id = receipt_item.purchase_order_item_id
    WHERE receipt_item.purchase_receipt_id = v_receipt.id
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM public.products product
      WHERE product.id = v_item.product_id
        AND ((COALESCE(product.variation_mode, 'sem_variacao') = 'sem_variacao' AND v_item.variant_id IS NULL)
          OR (product.variation_mode = 'variacoes_fisicas' AND EXISTS (
            SELECT 1 FROM public.product_variants variant WHERE variant.id = v_item.variant_id AND variant.product_id = product.id
          )))
    ) THEN
      RAISE EXCEPTION 'Identidade física inválida no item de recebimento %.', v_item.purchase_order_item_id;
    END IF;
    v_event_key := 'purchase_receipt:' || v_receipt.id::text || ':' || v_item.purchase_receipt_item_id::text || ':' || v_receipt.storage_location_id::text;
    IF EXISTS (SELECT 1 FROM public.inventory_movements WHERE event_key = v_event_key)
      OR EXISTS (SELECT 1 FROM public.glucodry_sealed_events WHERE event_key=v_event_key)
      OR EXISTS (SELECT 1 FROM public.chocolate_sealed_events WHERE event_key=v_event_key) THEN
      RAISE EXCEPTION 'Recebimento possui evento físico já registrado e precisa de reconciliação.';
    END IF;
  END LOOP;

  FOR v_item IN
    SELECT receipt_item.id AS purchase_receipt_item_id, purchase_item.product_id, purchase_item.variant_id,
      purchase_item.purchase_presentation_id,
      receipt_item.operational_received_qty, purchase_item.purchase_unit_label, receipt_item.received_purchase_qty
    FROM public.purchase_receipt_items receipt_item
    JOIN public.purchase_order_items purchase_item ON purchase_item.id = receipt_item.purchase_order_item_id
    WHERE receipt_item.purchase_receipt_id = v_receipt.id
    ORDER BY receipt_item.id
  LOOP
    IF v_item.product_id='92088a70-8cc0-40ef-a39d-564603df6866'::uuid AND v_item.purchase_presentation_id='820dead8-61a6-4b54-8b5a-8c6d15b5303e'::uuid THEN
      IF v_item.received_purchase_qty<>trunc(v_item.received_purchase_qty) OR
        v_item.operational_received_qty<>v_item.received_purchase_qty*25000 THEN
        RAISE EXCEPTION 'glucodry_gd2_receipt_requires_whole_sealed_sacks';
      END IF;
      v_event_key := 'purchase_receipt:'||v_receipt.id::text||':'||v_item.purchase_receipt_item_id::text||':'||v_receipt.storage_location_id::text;
      PERFORM public.glucodry_move_sealed_internal(v_receipt.storage_location_id,v_item.received_purchase_qty::integer,
        'purchase_receipt',v_receipt.id,v_event_key,'Recebimento físico de saco original lacrado de Glucodry 25kg');
      v_movement_count:=v_movement_count+1;
    ELSIF v_item.product_id='c70dd4b4-bc59-4d88-81ef-1a8c47315560'::uuid AND (
      (v_item.variant_id='f6588f52-6e28-4ce9-b492-a95c847d5c0c'::uuid AND v_item.purchase_presentation_id='91a58818-2010-4c6a-93bd-28b1f8f9e5af'::uuid)
      OR (v_item.variant_id='1a3d59a6-4712-4afd-811a-5a72aad76fa9'::uuid AND v_item.purchase_presentation_id='45ead74d-592e-4019-8d10-adc2d93242cc'::uuid)
    ) THEN
      IF v_item.received_purchase_qty<>trunc(v_item.received_purchase_qty)
        OR v_item.received_purchase_qty<1
        OR v_item.operational_received_qty<>v_item.received_purchase_qty*20000 THEN
        RAISE EXCEPTION 'cb3_receipt_requires_whole_original_20kg_sacks';
      END IF;
      v_event_key:='purchase_receipt:'||v_receipt.id::text||':'||v_item.purchase_receipt_item_id::text||':'||v_receipt.storage_location_id::text;
      PERFORM public.chocolate_move_sealed_internal(v_item.variant_id,v_receipt.storage_location_id,
        v_item.received_purchase_qty::integer,'purchase_receipt',v_receipt.id,v_event_key,
        'Recebimento físico de embalagens originais fechadas de Chocolate Base 20kg');
      v_movement_count:=v_movement_count+1;
    ELSE
    INSERT INTO public.inventory (product_id, variant_id, location, location_id, quantity, updated_at)
    VALUES (v_item.product_id, v_item.variant_id, v_location_name, v_receipt.storage_location_id, v_item.operational_received_qty, now())
    ON CONFLICT (product_id, variant_id, location) DO UPDATE SET
      quantity = public.inventory.quantity + EXCLUDED.quantity,
      location_id = EXCLUDED.location_id,
      updated_at = now()
    RETURNING quantity - v_item.operational_received_qty, quantity INTO v_previous_balance, v_new_balance;

    v_event_key := 'purchase_receipt:' || v_receipt.id::text || ':' || v_item.purchase_receipt_item_id::text || ':' || v_receipt.storage_location_id::text;
    INSERT INTO public.inventory_movements (
      product_id, variant_id, movement_type, quantity, previous_balance, new_balance,
      location, reference_type, reference_id, event_key, notes
    ) VALUES (
      v_item.product_id, v_item.variant_id, 'in', v_item.operational_received_qty,
      v_previous_balance, v_new_balance, v_location_name, 'purchase_receipt', v_receipt.id, v_event_key,
      'Entrada por recebimento de compra: ' || v_item.received_purchase_qty || ' ' || v_item.purchase_unit_label
    );
    v_movement_count := v_movement_count + 1;
    END IF;
  END LOOP;

  PERFORM set_config('app.purchase_receipt_confirmation', 'true', true);
  UPDATE public.purchase_receipts SET status = 'confirmed', received_at = COALESCE(received_at, now()),
    confirmed_at = now(), confirmed_by = COALESCE(confirmed_by, auth.uid()), updated_at = now()
  WHERE id = v_receipt.id;
  v_status := public.recalculate_purchase_order_receiving_status(v_order.id);
  RETURN jsonb_build_object('receipt_id', v_receipt.id, 'purchase_order_id', v_order.id,
    'already_confirmed', false, 'movement_count', v_movement_count, 'purchase_order_status', v_status);
END;
$function$;


CREATE OR REPLACE FUNCTION public.apply_order_stock_event(p_order_id uuid, p_event text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_item record; v_inventory record; v_remaining numeric; v_take numeric; v_applied numeric;
  v_key text; v_movement_count integer:=0; v_shortages jsonb:='[]'::jsonb; v_incident_key text;
BEGIN
  IF p_event NOT IN ('confirmed','cancelled','shipped','external_shipped') THEN
    RAISE EXCEPTION 'Evento de estoque de pedido inválido: %',p_event;
  END IF;
  PERFORM 1 FROM public.orders WHERE id=p_order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Pedido não encontrado'; END IF;
  IF p_event IN ('confirmed','cancelled') THEN
    RETURN jsonb_build_object('event',p_event,'applied',false,'already_applied',false,'movement_count',0,'adjustment_required',false);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.order_items WHERE order_id=p_order_id) THEN
    RAISE EXCEPTION 'Pedido sem itens não pode ser finalizado fisicamente';
  END IF;

  IF EXISTS (SELECT 1 FROM public.chocolate_sealed_events WHERE reference_type='order_stock_event' AND reference_id=p_order_id)
  OR EXISTS (SELECT 1 FROM public.glucodry_sealed_events WHERE reference_type='order_stock_event' AND reference_id=p_order_id)
    THEN RETURN jsonb_build_object('event',p_event,'applied',false,'already_applied',true,'movement_count',0,'adjustment_required',false);
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.inventory_movements WHERE reference_id=p_order_id AND movement_type='out'
      AND (reference_type='order' OR (reference_type='order_stock_event' AND event_key LIKE 'order:'||p_order_id::text||':physical_out:%'))
  ) OR EXISTS (
    SELECT 1 FROM public.operational_incidents WHERE source_type='order_separation' AND source_id=p_order_id
  ) THEN
    RETURN jsonb_build_object(
      'event',p_event,'applied',false,'already_applied',true,'movement_count',0,
      'adjustment_required',EXISTS(SELECT 1 FROM public.operational_incidents WHERE source_type='order_separation' AND source_id=p_order_id AND status IN ('open','in_review'))
    );
  END IF;

  -- GD2 uses sealed-sack stock, never the legacy grams inventory.
  FOR v_item IN
    SELECT oi.id,oi.quantity,oi.commercial_quantity,oi.commercial_presentation_id
    FROM public.order_items oi WHERE oi.order_id=p_order_id AND oi.commercial_presentation_id='8dd3b126-36bd-4bb2-a695-bdbfefdc8507'::uuid
    ORDER BY oi.id
  LOOP
    IF v_item.quantity<>1 OR v_item.commercial_quantity<>1 THEN
      RAISE EXCEPTION 'glucodry_gd2_one_sealed_sack_per_order_line';
    END IF;
    SELECT ss.storage_location_id INTO v_inventory
      FROM public.glucodry_sealed_stock ss
      WHERE ss.sacks>0 ORDER BY ss.storage_location_id LIMIT 1 FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'glucodry_gd2_no_sealed_sacks_available';
    END IF;
    PERFORM public.glucodry_move_sealed_internal(v_inventory.storage_location_id,-1,
      'order_stock_event',p_order_id,'order:'||p_order_id::text||':sealed_out:'||v_item.id::text,
      'Separação: saída física de 1 saco Glucodry lacrado');
    v_movement_count:=v_movement_count+1;
  END LOOP;

  -- CB3 physically ships ORIGINAL sealed 20kg bags, never draws opened grams.
  FOR v_item IN
    SELECT oi.id,oi.product_id,oi.variant_id,oi.quantity,oi.commercial_quantity,
           oi.commercial_presentation_id
    FROM public.order_items oi
    WHERE oi.order_id=p_order_id AND oi.commercial_presentation_id IN
      ('c8b30000-0000-4000-8000-000000000001'::uuid,'c8b30000-0000-4000-8000-000000000002'::uuid)
    ORDER BY oi.id
  LOOP
    IF v_item.product_id<>'c70dd4b4-bc59-4d88-81ef-1a8c47315560'::uuid
      OR NOT ((v_item.commercial_presentation_id='c8b30000-0000-4000-8000-000000000001'::uuid AND v_item.variant_id='f6588f52-6e28-4ce9-b492-a95c847d5c0c'::uuid)
        OR (v_item.commercial_presentation_id='c8b30000-0000-4000-8000-000000000002'::uuid AND v_item.variant_id='1a3d59a6-4712-4afd-811a-5a72aad76fa9'::uuid))
      OR v_item.quantity<>v_item.commercial_quantity
      OR v_item.quantity<>trunc(v_item.quantity) OR v_item.quantity<1 THEN
      RAISE EXCEPTION 'cb3_order_requires_correct_sealed_cover_and_whole_sacks';
    END IF;
    FOR v_inventory IN
      SELECT ss.storage_location_id,ss.sacks
      FROM public.chocolate_sealed_stock ss
      WHERE ss.variant_id=v_item.variant_id AND ss.sacks>0 ORDER BY ss.storage_location_id FOR UPDATE
    LOOP
      EXIT WHEN v_item.quantity<=0;
      v_take:=least(v_item.quantity,v_inventory.sacks);
      PERFORM public.chocolate_move_sealed_internal(v_item.variant_id,v_inventory.storage_location_id,
        -(v_take::integer),'order_stock_event',p_order_id,
        'order:'||p_order_id::text||':cb3_out:'||v_item.id::text||':'||v_inventory.storage_location_id::text,
        'Expedição física de Chocolate Base CB3 em sacos lacrados');
      v_item.quantity:=v_item.quantity-v_take;
      v_movement_count:=v_movement_count+1;
    END LOOP;
    IF v_item.quantity>0 THEN RAISE EXCEPTION 'cb3_sealed_sacks_insufficient_for_shipment';END IF;
  END LOOP;

  FOR v_item IN
    SELECT oi.product_id,oi.variant_id,sum(oi.quantity) required_quantity,
           p.name product_name,pv.variant_name,COALESCE(pv.unit,p.unit) unit
    FROM public.order_items oi JOIN public.products p ON p.id=oi.product_id
    LEFT JOIN public.product_variants pv ON pv.id=oi.variant_id
    WHERE oi.order_id=p_order_id AND oi.commercial_presentation_id IS DISTINCT FROM '8dd3b126-36bd-4bb2-a695-bdbfefdc8507'::uuid
      AND (oi.commercial_presentation_id IS NULL OR oi.commercial_presentation_id NOT IN ('c8b30000-0000-4000-8000-000000000001'::uuid,'c8b30000-0000-4000-8000-000000000002'::uuid))
    GROUP BY oi.product_id,oi.variant_id,p.name,pv.variant_name,p.unit,pv.unit
    ORDER BY oi.product_id,oi.variant_id
  LOOP
    v_remaining:=v_item.required_quantity; v_applied:=0;
    FOR v_inventory IN
      SELECT id,location,quantity FROM public.inventory
      WHERE product_id=v_item.product_id AND variant_id IS NOT DISTINCT FROM v_item.variant_id AND quantity>0
      ORDER BY id FOR UPDATE
    LOOP
      EXIT WHEN v_remaining<=0;
      v_take:=LEAST(v_remaining,v_inventory.quantity);
      v_key:='order:'||p_order_id::text||':physical_out:'||v_item.product_id::text||':'||COALESCE(v_item.variant_id::text,'simple')||':'||COALESCE(v_inventory.location,'sem-localizacao');
      UPDATE public.inventory SET quantity=quantity-v_take,updated_at=now() WHERE id=v_inventory.id;
      INSERT INTO public.inventory_movements(
        product_id,variant_id,movement_type,quantity,previous_balance,new_balance,location,
        reference_type,reference_id,event_key,notes
      ) VALUES (
        v_item.product_id,v_item.variant_id,'out',v_take,v_inventory.quantity,v_inventory.quantity-v_take,
        v_inventory.location,'order_stock_event',p_order_id,v_key,'Saída física por expedição de pedido'
      );
      v_remaining:=v_remaining-v_take; v_applied:=v_applied+v_take; v_movement_count:=v_movement_count+1;
    END LOOP;

    IF v_remaining>0 THEN
      v_incident_key:='order_separation_shortage:'||p_order_id::text||':'||v_item.product_id::text||':'||COALESCE(v_item.variant_id::text,'simple');
      INSERT INTO public.operational_incidents(
        area,incident_type,status,severity,title,description,source_type,source_id,
        product_id,variant_id,expected_quantity,applied_quantity,pending_quantity,unit,event_key,metadata
      ) VALUES (
        'separation','stock_shortage','open','critical','Saída física com saldo sistêmico insuficiente',
        'A separação foi finalizada fisicamente; a diferença precisa ser regularizada no estoque.',
        'order_separation',p_order_id,v_item.product_id,v_item.variant_id,v_item.required_quantity,v_applied,v_remaining,
        v_item.unit,v_incident_key,
        jsonb_build_object('product_name',v_item.product_name,'variant_name',v_item.variant_name,'event',p_event)
      ) ON CONFLICT(event_key) DO UPDATE SET
        status='open',expected_quantity=EXCLUDED.expected_quantity,applied_quantity=EXCLUDED.applied_quantity,
        pending_quantity=EXCLUDED.pending_quantity,metadata=EXCLUDED.metadata,updated_at=now();
      v_shortages:=v_shortages||jsonb_build_array(jsonb_build_object(
        'product_id',v_item.product_id,'variant_id',v_item.variant_id,'product_name',v_item.product_name,
        'variant_name',v_item.variant_name,'unit',v_item.unit,'required_quantity',v_item.required_quantity,
        'applied_quantity',v_applied,'missing_quantity',v_remaining
      ));
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'event',p_event,'applied',true,'already_applied',false,'movement_count',v_movement_count,
    'adjustment_required',jsonb_array_length(v_shortages)>0,'shortages',v_shortages
  );
END; $function$;


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

    IF v_component.component_id='c70dd4b4-bc59-4d88-81ef-1a8c47315560'::uuid
      AND v_component.variant_id IN ('f6588f52-6e28-4ce9-b492-a95c847d5c0c'::uuid,'1a3d59a6-4712-4afd-811a-5a72aad76fa9'::uuid) THEN
      PERFORM public.ensure_chocolate_production_material(v_fact_id,v_component.variant_id,v_remaining,'production_fact');
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
$function$;


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

    IF v_consumption.component_id='c70dd4b4-bc59-4d88-81ef-1a8c47315560'::uuid
      AND v_consumption.variant_id IN ('f6588f52-6e28-4ce9-b492-a95c847d5c0c'::uuid,'1a3d59a6-4712-4afd-811a-5a72aad76fa9'::uuid) THEN
      PERFORM public.ensure_chocolate_production_material(p_production_fact_id,v_consumption.variant_id,v_remaining,'production_fact');
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
$function$;


CREATE OR REPLACE FUNCTION public.complete_production_order_legacy(p_production_order_id uuid, p_finished_location text DEFAULT 'Fábrica'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_order public.production_orders; v_item record; v_component record; v_inventory record; v_available numeric; v_remaining numeric; v_take numeric; v_previous numeric; v_new numeric; v_shortages jsonb:='[]'::jsonb; v_missing_bom_items jsonb:='[]'::jsonb; v_count integer:=0; v_location text:=COALESCE(NULLIF(btrim(p_finished_location),''),'Fábrica'); v_key text;
BEGIN
  SELECT * INTO v_order FROM public.production_orders WHERE id=p_production_order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Ordem de produção não encontrada'; END IF;
  IF v_order.status='concluido' THEN RETURN jsonb_build_object('success',true,'already_completed',true,'movement_count',0,'shortages','[]'::jsonb); END IF;
  IF v_order.status='cancelado' THEN RETURN jsonb_build_object('success',false,'reason','cancelled','shortages','[]'::jsonb); END IF;
  IF NOT EXISTS (SELECT 1 FROM public.production_order_items WHERE production_order_id=v_order.id) THEN RETURN jsonb_build_object('success',false,'reason','missing_items','shortages','[]'::jsonb); END IF;
  IF EXISTS (SELECT 1 FROM public.production_order_items WHERE production_order_id=v_order.id AND produced_quantity<=0) THEN RETURN jsonb_build_object('success',false,'reason','no_produced_quantity','shortages','[]'::jsonb); END IF;
  FOR v_item IN SELECT item.id,item.product_id,item.variant_id,p.name product_name,pv.variant_name FROM public.production_order_items item JOIN public.products p ON p.id=item.product_id LEFT JOIN public.product_variants pv ON pv.id=item.variant_id WHERE item.production_order_id=v_order.id LOOP
    IF NOT EXISTS (SELECT 1 FROM public.product_components pc WHERE pc.product_id=v_item.product_id AND pc.product_variant_id IS NOT DISTINCT FROM v_item.variant_id) THEN
      v_missing_bom_items:=v_missing_bom_items||jsonb_build_array(jsonb_build_object('production_order_item_id',v_item.id,'product_id',v_item.product_id,'variant_id',v_item.variant_id,'product_name',v_item.product_name,'variant_name',v_item.variant_name));
    END IF;
  END LOOP;
  IF jsonb_array_length(v_missing_bom_items)>0 THEN RETURN jsonb_build_object('success',false,'reason','missing_bom','missing_bom_items',v_missing_bom_items,'shortages','[]'::jsonb); END IF;
  FOR v_component IN SELECT pc.component_id,pc.variant_id,sum(pc.qty_per_unit*item.produced_quantity) required_quantity,p.name component_name,pv.variant_name,COALESCE(pv.sku,p.sku) component_sku FROM public.production_order_items item JOIN public.product_components pc ON pc.product_id=item.product_id AND pc.product_variant_id IS NOT DISTINCT FROM item.variant_id JOIN public.products p ON p.id=pc.component_id LEFT JOIN public.product_variants pv ON pv.id=pc.variant_id WHERE item.production_order_id=v_order.id GROUP BY pc.component_id,pc.variant_id,p.name,pv.variant_name,p.sku,pv.sku LOOP
    v_available:=0; FOR v_inventory IN SELECT quantity FROM public.inventory WHERE product_id=v_component.component_id AND variant_id IS NOT DISTINCT FROM v_component.variant_id FOR UPDATE LOOP v_available:=v_available+v_inventory.quantity; END LOOP;
    IF v_component.component_id='c70dd4b4-bc59-4d88-81ef-1a8c47315560'::uuid
      AND v_component.variant_id IN ('f6588f52-6e28-4ce9-b492-a95c847d5c0c'::uuid,'1a3d59a6-4712-4afd-811a-5a72aad76fa9'::uuid) AND v_available<v_component.required_quantity THEN
      PERFORM public.ensure_chocolate_production_material(v_order.id,v_component.variant_id,
        v_component.required_quantity,'production_order');
      SELECT coalesce(sum(quantity),0) INTO v_available FROM public.inventory
      WHERE product_id=v_component.component_id AND variant_id=v_component.variant_id;
    END IF;
    IF v_available<v_component.required_quantity THEN v_shortages:=v_shortages||jsonb_build_array(jsonb_build_object('product_id',v_component.component_id,'variant_id',v_component.variant_id,'component_name',v_component.component_name,'component_variant_name',v_component.variant_name,'component_sku',v_component.component_sku,'required_quantity',v_component.required_quantity,'available_quantity',v_available,'missing_quantity',v_component.required_quantity-v_available)); END IF;
    v_count:=v_count+1;
  END LOOP;
  IF v_count=0 THEN RETURN jsonb_build_object('success',false,'reason','missing_bom','missing_bom_items',v_missing_bom_items,'shortages','[]'::jsonb); END IF;
  IF jsonb_array_length(v_shortages)>0 THEN RETURN jsonb_build_object('success',false,'reason','insufficient_stock','shortages',v_shortages); END IF;
  FOR v_component IN SELECT pc.component_id,pc.variant_id,sum(pc.qty_per_unit*item.produced_quantity) required_quantity FROM public.production_order_items item JOIN public.product_components pc ON pc.product_id=item.product_id AND pc.product_variant_id IS NOT DISTINCT FROM item.variant_id WHERE item.production_order_id=v_order.id GROUP BY pc.component_id,pc.variant_id LOOP
    v_remaining:=v_component.required_quantity; FOR v_inventory IN SELECT id,location,quantity FROM public.inventory WHERE product_id=v_component.component_id AND variant_id IS NOT DISTINCT FROM v_component.variant_id AND quantity>0 ORDER BY quantity DESC,id FOR UPDATE LOOP EXIT WHEN v_remaining<=0; v_take:=LEAST(v_remaining,v_inventory.quantity); v_key:='production:'||v_order.id::text||':consume:'||v_component.component_id::text||':'||COALESCE(v_component.variant_id::text,'simple')||':'||COALESCE(v_inventory.location,'sem-localizacao'); UPDATE public.inventory SET quantity=quantity-v_take,updated_at=now() WHERE id=v_inventory.id; INSERT INTO public.inventory_movements(product_id,variant_id,movement_type,quantity,previous_balance,new_balance,location,reference_type,reference_id,event_key,notes) VALUES(v_component.component_id,v_component.variant_id,'consume',v_take,v_inventory.quantity,v_inventory.quantity-v_take,v_inventory.location,'production_order',v_order.id,v_key,'Consumo por conclusão da OP '||COALESCE(v_order.internal_production_number,v_order.order_number,v_order.id::text)); v_remaining:=v_remaining-v_take; END LOOP;
  END LOOP;
  FOR v_item IN SELECT * FROM public.production_order_items WHERE production_order_id=v_order.id ORDER BY created_at,id LOOP
    v_key:='production:'||v_order.id::text||':finished:'||v_item.product_id::text||':'||COALESCE(v_item.variant_id::text,'simple')||':'||v_location;
    INSERT INTO public.inventory(product_id,variant_id,location,quantity,updated_at) VALUES(v_item.product_id,v_item.variant_id,v_location,v_item.produced_quantity,now()) ON CONFLICT(product_id,variant_id,location) DO UPDATE SET quantity=public.inventory.quantity+EXCLUDED.quantity,updated_at=now() RETURNING quantity-v_item.produced_quantity,quantity INTO v_previous,v_new;
    INSERT INTO public.inventory_movements(product_id,variant_id,movement_type,quantity,previous_balance,new_balance,location,reference_type,reference_id,event_key,notes) VALUES(v_item.product_id,v_item.variant_id,'in',v_item.produced_quantity,v_previous,v_new,v_location,'production_order',v_order.id,v_key,'Entrada por conclusão da OP '||COALESCE(v_order.internal_production_number,v_order.order_number,v_order.id::text));
  END LOOP;
  UPDATE public.production_orders SET status='concluido',completed_at=now(),updated_at=now() WHERE id=v_order.id;
  RETURN jsonb_build_object('success',true,'already_completed',false,'movement_count',v_count,'shortages','[]'::jsonb);
END; $function$;
