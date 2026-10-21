-- Operações / Glucodry GD2 — estoque de sacos lacrados sem migração de gramas históricas.
-- Produto simples canônico e 37.000g históricos preservados. Nenhum saco criado automaticamente.
-- Venda GD1 em gramas permanece inalterada, GD2 expede sacos fechados.

CREATE TABLE IF NOT EXISTS public.glucodry_sealed_stock (
  storage_location_id uuid PRIMARY KEY REFERENCES public.storage_locations(id),
  sacks integer NOT NULL DEFAULT 0 CHECK(sacks >= 0),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.glucodry_sealed_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_key text NOT NULL UNIQUE,
  storage_location_id uuid NOT NULL REFERENCES public.storage_locations(id),
  movement_type text NOT NULL CHECK(movement_type IN ('in','out')),
  sacks integer NOT NULL CHECK(sacks > 0),
  previous_balance integer NOT NULL,
  new_balance integer NOT NULL CHECK(new_balance >= 0),
  reference_type text NOT NULL,
  reference_id uuid,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_glucodry_sealed_events_reference ON public.glucodry_sealed_events(reference_type,reference_id);
ALTER TABLE public.glucodry_sealed_stock ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.glucodry_sealed_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS glucodry_sealed_stock_read ON public.glucodry_sealed_stock;
DROP POLICY IF EXISTS glucodry_sealed_events_read ON public.glucodry_sealed_events;
CREATE POLICY glucodry_sealed_stock_read ON public.glucodry_sealed_stock FOR SELECT TO authenticated USING ((SELECT auth.uid()) IS NOT NULL);
CREATE POLICY glucodry_sealed_events_read ON public.glucodry_sealed_events FOR SELECT TO authenticated USING ((SELECT auth.uid()) IS NOT NULL);
REVOKE ALL ON public.glucodry_sealed_stock, public.glucodry_sealed_events FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.glucodry_sealed_stock,public.glucodry_sealed_events TO authenticated;
-- Only server-side stock events change sealed quantities; no direct browser writes.

CREATE OR REPLACE FUNCTION public.glucodry_move_sealed_internal(
  p_location_id uuid,p_delta integer,p_reference_type text,p_reference_id uuid,
  p_event_key text,p_notes text
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $fn$
DECLARE v_old integer; v_new integer;
BEGIN
  IF p_delta IS NULL OR p_delta=0 OR abs(p_delta)>10000 THEN RAISE EXCEPTION 'invalid_glucodry_sack_delta'; END IF;
  IF nullif(btrim(p_event_key),'') IS NULL THEN RAISE EXCEPTION 'event_key_required'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.storage_locations WHERE id=p_location_id AND is_active) THEN RAISE EXCEPTION 'invalid_location'; END IF;
  IF EXISTS(SELECT 1 FROM public.glucodry_sealed_events WHERE event_key=p_event_key) THEN RAISE EXCEPTION 'duplicate_glucodry_sealed_event'; END IF;
  INSERT INTO public.glucodry_sealed_stock(storage_location_id,sacks) VALUES (p_location_id,0)
    ON CONFLICT(storage_location_id) DO NOTHING;
  SELECT sacks INTO v_old FROM public.glucodry_sealed_stock WHERE storage_location_id=p_location_id FOR UPDATE;
  v_new:=v_old+p_delta;
  IF v_new<0 THEN RAISE EXCEPTION 'glucodry_insufficient_sealed_sacks: required %, available %',-p_delta,v_old; END IF;
  UPDATE public.glucodry_sealed_stock SET sacks=v_new,updated_at=now() WHERE storage_location_id=p_location_id;
  INSERT INTO public.glucodry_sealed_events(
    event_key,storage_location_id,movement_type,sacks,previous_balance,new_balance,
    reference_type,reference_id,notes,created_by
  ) VALUES(p_event_key,p_location_id,CASE WHEN p_delta>0 THEN 'in' ELSE 'out' END,
    abs(p_delta),v_old,v_new,p_reference_type,p_reference_id,p_notes,auth.uid());
END;$fn$;
REVOKE ALL ON FUNCTION public.glucodry_move_sealed_internal(uuid,integer,text,uuid,text,text) FROM PUBLIC,anon,authenticated;

-- Conversão de ESTADO FÍSICO, exclusivamente mediante confirmação do operador.
-- Nenhuma equivalência histórica é convertida automaticamente.
CREATE OR REPLACE FUNCTION public.glucodry_convert_physical_stock(
 p_direction text,p_sacks integer,p_location_id uuid,p_event_key text,p_confirmed boolean
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $fn$
DECLARE v_grams numeric; v_old numeric; v_new numeric; v_location text; v_event uuid:=gen_random_uuid();
BEGIN
 IF (SELECT auth.uid()) IS NULL OR COALESCE(public.current_app_user_role(),'') NOT IN ('Administrador','LIDER PRODUÇÃO')
 THEN RAISE EXCEPTION 'inventory_manager_required'; END IF;
 IF p_direction NOT IN ('open','reclassify') OR p_sacks IS NULL OR p_sacks<1 OR p_sacks>1000 OR p_confirmed IS DISTINCT FROM true
 THEN RAISE EXCEPTION 'invalid_glucodry_physical_conversion'; END IF;
 IF p_event_key IS NULL OR p_event_key !~ '^glucodry:[0-9a-f-]{36}$'
 THEN RAISE EXCEPTION 'invalid_glucodry_event_key'; END IF;
 SELECT name INTO v_location FROM public.storage_locations WHERE id=p_location_id AND is_active;
 IF NOT FOUND THEN RAISE EXCEPTION 'invalid_location'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('glucodry:conversion:'||p_location_id::text,0));
 IF EXISTS (SELECT 1 FROM public.glucodry_sealed_events WHERE event_key=p_event_key||':sacks')
 THEN RETURN jsonb_build_object('success',true,'already_processed',true); END IF;
 v_grams:=25000*p_sacks;
 INSERT INTO public.inventory(product_id,variant_id,location,location_id,quantity,updated_at)
 VALUES ('92088a70-8cc0-40ef-a39d-564603df6866'::uuid,NULL,v_location,p_location_id,0,now())
 ON CONFLICT(product_id,variant_id,location) DO NOTHING;
 SELECT quantity INTO v_old FROM public.inventory WHERE product_id='92088a70-8cc0-40ef-a39d-564603df6866'::uuid
 AND variant_id IS NULL AND location=v_location FOR UPDATE;
 IF v_old IS NULL THEN RAISE EXCEPTION 'glucodry_gram_inventory_missing'; END IF;
 IF p_direction='reclassify' THEN
   IF v_old<v_grams THEN RAISE EXCEPTION 'glucodry_legacy_grams_insufficient: required %, available %',v_grams,v_old; END IF;
   PERFORM public.glucodry_move_sealed_internal(p_location_id,p_sacks,'glucodry_conversion',v_event,p_event_key||':sacks','Conferência física de saco(s) lacrados no saldo histórico');
   v_new:=v_old-v_grams;
 ELSE
   PERFORM public.glucodry_move_sealed_internal(p_location_id,-p_sacks,'glucodry_conversion',v_event,p_event_key||':sacks','Abertura física de saco(s) lacrados');
   v_new:=v_old+v_grams;
 END IF;
 UPDATE public.inventory SET quantity=v_new,updated_at=now() WHERE product_id='92088a70-8cc0-40ef-a39d-564603df6866'::uuid AND variant_id IS NULL AND location=v_location;
 INSERT INTO public.inventory_movements(product_id,variant_id,movement_type,quantity,previous_balance,new_balance,location,reference_type,reference_id,event_key,notes,created_by)
 VALUES('92088a70-8cc0-40ef-a39d-564603df6866'::uuid,NULL,CASE WHEN p_direction='open' THEN 'in' ELSE 'out' END,
 v_grams,v_old,v_new,v_location,'glucodry_physical_conversion',v_event,p_event_key||':grams',
 CASE WHEN p_direction='open' THEN 'Saco(s) abertos fisicamente: entrada de 25.000g por saco' ELSE 'Reclassificação de saco(s) realmente lacrados: saída do saldo histórico em gramas' END,auth.uid()::text);
 RETURN jsonb_build_object('success',true,'already_processed',false,'direction',p_direction,'sacks',p_sacks,
 'grams',v_grams,'open_grams_balance',v_new,'event_key',p_event_key);
END;$fn$;
REVOKE ALL ON FUNCTION public.glucodry_convert_physical_stock(text,integer,uuid,text,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.glucodry_convert_physical_stock(text,integer,uuid,text,boolean) TO authenticated;

-- GD2 comercial: 1 apresentação = 1 saco original fechado. Não criar Produto Mestre novo.
INSERT INTO public.commercial_presentations
(id,product_id,variant_id,name,commercial_unit_label,conversion_factor,composition_mode,is_active,notes)
VALUES ('8dd3b126-36bd-4bb2-a695-bdbfefdc8507'::uuid,'92088a70-8cc0-40ef-a39d-564603df6866'::uuid,NULL,
'Saco fechado original 25 kg','saco',1,'single',true,
'GD2: 1 saco lacrado físico, disponível exclusivamente no saldo de sacos. Não baixar gramas abertas. Preço R$ 449 apenas como referência comercial do laboratório; confirmar preço negociado.')
ON CONFLICT(id) DO NOTHING;
DO $fn$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM public.commercial_presentations WHERE id='8dd3b126-36bd-4bb2-a695-bdbfefdc8507'::uuid AND product_id='92088a70-8cc0-40ef-a39d-564603df6866'::uuid AND conversion_factor=1 AND composition_mode='single' AND variant_id IS NULL)
 THEN RAISE EXCEPTION 'gd2_presentation_identity_mismatch'; END IF;
END;$fn$;

-- Safe, narrowly-scoped extensions of canonical purchase and shipment RPCs:
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
      OR EXISTS (SELECT 1 FROM public.glucodry_sealed_events WHERE event_key=v_event_key) THEN
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

  IF EXISTS (SELECT 1 FROM public.glucodry_sealed_events WHERE reference_type='order_stock_event' AND reference_id=p_order_id)
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

  FOR v_item IN
    SELECT oi.product_id,oi.variant_id,sum(oi.quantity) required_quantity,
           p.name product_name,pv.variant_name,COALESCE(pv.unit,p.unit) unit
    FROM public.order_items oi JOIN public.products p ON p.id=oi.product_id
    LEFT JOIN public.product_variants pv ON pv.id=oi.variant_id
    WHERE oi.order_id=p_order_id AND oi.commercial_presentation_id IS DISTINCT FROM '8dd3b126-36bd-4bb2-a695-bdbfefdc8507'::uuid
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
