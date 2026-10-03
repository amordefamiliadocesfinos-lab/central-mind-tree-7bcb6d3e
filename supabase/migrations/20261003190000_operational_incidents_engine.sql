-- F09 — Motor Universal de Intercorrências / Ajustes
-- Regra: o fato físico continua; a divergência permanece rastreável até resolução.

CREATE TABLE IF NOT EXISTS public.operational_incidents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  area text NOT NULL CHECK (area IN ('production','separation','receiving','inventory','purchases','other')),
  incident_type text NOT NULL,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','in_review','resolved','dismissed')),
  severity text NOT NULL DEFAULT 'warning' CHECK (severity IN ('info','warning','critical')),
  title text NOT NULL,
  description text,
  source_type text,
  source_id uuid,
  source_item_id uuid,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  variant_id uuid REFERENCES public.product_variants(id) ON DELETE SET NULL,
  expected_quantity numeric,
  applied_quantity numeric NOT NULL DEFAULT 0,
  pending_quantity numeric NOT NULL DEFAULT 0 CHECK (pending_quantity >= 0),
  unit text,
  event_key text UNIQUE,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  resolved_by uuid,
  resolution_note text
);

CREATE INDEX IF NOT EXISTS idx_operational_incidents_open
  ON public.operational_incidents(status, area, created_at);
CREATE INDEX IF NOT EXISTS idx_operational_incidents_source
  ON public.operational_incidents(source_type, source_id);
CREATE INDEX IF NOT EXISTS idx_operational_incidents_identity
  ON public.operational_incidents(product_id, variant_id, status);

ALTER TABLE public.operational_incidents ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated read operational incidents" ON public.operational_incidents;
CREATE POLICY "Authenticated read operational incidents"
  ON public.operational_incidents FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Service role manage operational incidents" ON public.operational_incidents;
CREATE POLICY "Service role manage operational incidents"
  ON public.operational_incidents FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.assert_operational_incident_manager()
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public
AS $$
DECLARE v_role text; v_jwt_role text := current_setting('request.jwt.claim.role', true);
BEGIN
  IF v_jwt_role='service_role' THEN RETURN; END IF;
  SELECT role INTO v_role FROM public.app_users
   WHERE auth_user_id=auth.uid() AND is_active
   ORDER BY created_at ASC LIMIT 1;
  IF COALESCE(v_role,'') NOT IN ('Administrador','LIDER PRODUÇÃO') THEN
    RAISE EXCEPTION 'operational_incident_manager_required';
  END IF;
END; $$;

CREATE OR REPLACE FUNCTION public.report_operational_incident(
  p_area text,
  p_incident_type text,
  p_title text,
  p_description text DEFAULT NULL,
  p_product_id uuid DEFAULT NULL,
  p_variant_id uuid DEFAULT NULL,
  p_expected_quantity numeric DEFAULT NULL,
  p_applied_quantity numeric DEFAULT 0,
  p_unit text DEFAULT NULL,
  p_source_type text DEFAULT 'manual',
  p_source_id uuid DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'::jsonb
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public
AS $$
DECLARE v_id uuid; v_pending numeric;
BEGIN
  IF auth.uid() IS NULL AND current_setting('request.jwt.claim.role',true) <> 'service_role' THEN
    RAISE EXCEPTION 'authentication_required';
  END IF;
  IF p_area NOT IN ('production','separation','receiving','inventory','purchases','other') THEN
    RETURN jsonb_build_object('success',false,'reason','invalid_area');
  END IF;
  v_pending := GREATEST(COALESCE(p_expected_quantity,0)-COALESCE(p_applied_quantity,0),0);
  INSERT INTO public.operational_incidents(
    area,incident_type,title,description,source_type,source_id,
    product_id,variant_id,expected_quantity,applied_quantity,pending_quantity,unit,
    metadata,created_by,event_key
  ) VALUES (
    p_area,COALESCE(NULLIF(btrim(p_incident_type),''),'manual'),
    COALESCE(NULLIF(btrim(p_title),''),'Intercorrência operacional'),p_description,
    COALESCE(NULLIF(btrim(p_source_type),''),'manual'),p_source_id,
    p_product_id,p_variant_id,p_expected_quantity,COALESCE(p_applied_quantity,0),v_pending,p_unit,
    COALESCE(p_metadata,'{}'::jsonb),auth.uid(),'manual:'||gen_random_uuid()::text
  ) RETURNING id INTO v_id;
  RETURN jsonb_build_object('success',true,'incident_id',v_id);
END; $$;

-- Produção: projeta automaticamente cada consumo pendente na fila universal.
CREATE OR REPLACE FUNCTION public.sync_production_material_incident()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public
AS $$
DECLARE v_event_key text := 'production_material:'||NEW.id::text; v_name text; v_variant text;
BEGIN
  SELECT p.name, pv.variant_name INTO v_name,v_variant
  FROM public.products p LEFT JOIN public.product_variants pv ON pv.id=NEW.variant_id
  WHERE p.id=NEW.component_id;

  IF NEW.adjustment_status='pending' AND NEW.quantity_applied < NEW.quantity_consumed THEN
    INSERT INTO public.operational_incidents(
      area,incident_type,status,severity,title,description,source_type,source_id,source_item_id,
      product_id,variant_id,expected_quantity,applied_quantity,pending_quantity,unit,event_key,metadata,updated_at
    ) VALUES (
      'production','material_shortage','open','warning','Material de produção pendente',
      'Produção registrada; consumo sistêmico precisa ser regularizado.',
      'production_fact_consumption',NEW.production_fact_id,NEW.id,
      NEW.component_id,NEW.variant_id,NEW.quantity_consumed,NEW.quantity_applied,
      GREATEST(NEW.quantity_consumed-NEW.quantity_applied,0),NEW.unit_snapshot,v_event_key,
      jsonb_build_object('component_name',v_name,'variant_name',v_variant),now()
    ) ON CONFLICT(event_key) DO UPDATE SET
      status='open',resolved_at=NULL,resolved_by=NULL,
      expected_quantity=EXCLUDED.expected_quantity,
      applied_quantity=EXCLUDED.applied_quantity,
      pending_quantity=EXCLUDED.pending_quantity,
      metadata=EXCLUDED.metadata,updated_at=now();
  ELSE
    UPDATE public.operational_incidents SET
      status='resolved',pending_quantity=0,applied_quantity=COALESCE(NEW.quantity_applied,applied_quantity),
      resolved_at=COALESCE(resolved_at,now()),updated_at=now(),
      resolution_note=COALESCE(resolution_note,'Regularizado pelo ajuste de materiais da produção')
    WHERE event_key=v_event_key AND status IN ('open','in_review');
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_sync_production_material_incident ON public.production_fact_consumptions;
CREATE TRIGGER trg_sync_production_material_incident
AFTER INSERT OR UPDATE OF quantity_applied,adjustment_status ON public.production_fact_consumptions
FOR EACH ROW EXECUTE FUNCTION public.sync_production_material_incident();

INSERT INTO public.operational_incidents(
  area,incident_type,status,severity,title,description,source_type,source_id,source_item_id,
  product_id,variant_id,expected_quantity,applied_quantity,pending_quantity,unit,event_key,metadata
)
SELECT 'production','material_shortage','open','warning','Material de produção pendente',
       'Produção registrada; consumo sistêmico precisa ser regularizado.',
       'production_fact_consumption',pfc.production_fact_id,pfc.id,pfc.component_id,pfc.variant_id,
       pfc.quantity_consumed,pfc.quantity_applied,GREATEST(pfc.quantity_consumed-pfc.quantity_applied,0),
       pfc.unit_snapshot,'production_material:'||pfc.id::text,
       jsonb_build_object('component_name',p.name,'variant_name',pv.variant_name)
FROM public.production_fact_consumptions pfc
JOIN public.products p ON p.id=pfc.component_id
LEFT JOIN public.product_variants pv ON pv.id=pfc.variant_id
WHERE pfc.adjustment_status='pending' AND pfc.quantity_applied<pfc.quantity_consumed
ON CONFLICT(event_key) DO NOTHING;

-- Separação/expedição: consome o saldo disponível, registra o faltante e NÃO bloqueia o fato físico.
CREATE OR REPLACE FUNCTION public.apply_order_stock_event(p_order_id uuid, p_event text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public
AS $$
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

  FOR v_item IN
    SELECT oi.product_id,oi.variant_id,sum(oi.quantity) required_quantity,
           p.name product_name,pv.variant_name,COALESCE(pv.unit,p.unit) unit
    FROM public.order_items oi JOIN public.products p ON p.id=oi.product_id
    LEFT JOIN public.product_variants pv ON pv.id=oi.variant_id
    WHERE oi.order_id=p_order_id
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
END; $$;

-- Reconciliador universal: corrige apenas a parcela pendente, nunca refaz o fato físico original.
CREATE OR REPLACE FUNCTION public.reconcile_operational_incident(
  p_incident_id uuid,
  p_resolution_note text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public
AS $$
DECLARE
  v_inc public.operational_incidents%ROWTYPE; v_inventory record; v_remaining numeric; v_take numeric;
  v_before numeric; v_movement_count integer:=0; v_result jsonb;
BEGIN
  PERFORM public.assert_operational_incident_manager();
  SELECT * INTO v_inc FROM public.operational_incidents WHERE id=p_incident_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('success',false,'reason','incident_not_found'); END IF;
  IF v_inc.status IN ('resolved','dismissed') THEN
    RETURN jsonb_build_object('success',true,'already_resolved',true,'status',v_inc.status);
  END IF;

  IF v_inc.source_type='production_fact_consumption' THEN
    v_result:=public.reconcile_production_fact_materials(v_inc.source_id);
    SELECT * INTO v_inc FROM public.operational_incidents WHERE id=p_incident_id;
    RETURN jsonb_build_object('success',true,'status',v_inc.status,'pending_quantity',v_inc.pending_quantity,'details',v_result);
  END IF;

  IF v_inc.source_type='order_separation' AND v_inc.incident_type='stock_shortage' THEN
    v_remaining:=v_inc.pending_quantity;
    FOR v_inventory IN
      SELECT id,location,quantity FROM public.inventory
      WHERE product_id=v_inc.product_id AND variant_id IS NOT DISTINCT FROM v_inc.variant_id AND quantity>0
      ORDER BY id FOR UPDATE
    LOOP
      EXIT WHEN v_remaining<=0;
      v_take:=LEAST(v_remaining,v_inventory.quantity);
      v_before:=v_inc.pending_quantity-v_remaining;
      UPDATE public.inventory SET quantity=quantity-v_take,updated_at=now() WHERE id=v_inventory.id;
      INSERT INTO public.inventory_movements(
        product_id,variant_id,movement_type,quantity,previous_balance,new_balance,location,
        reference_type,reference_id,event_key,notes
      ) VALUES (
        v_inc.product_id,v_inc.variant_id,'out',v_take,v_inventory.quantity,v_inventory.quantity-v_take,
        v_inventory.location,'operational_incident',v_inc.id,
        'operational_incident:'||v_inc.id::text||':reconcile:'||v_inventory.id::text||':'||v_before::text,
        'Regularização posterior de saída física já realizada'
      );
      v_remaining:=v_remaining-v_take; v_movement_count:=v_movement_count+1;
    END LOOP;

    UPDATE public.operational_incidents SET
      applied_quantity=COALESCE(expected_quantity,0)-v_remaining,
      pending_quantity=v_remaining,
      status=CASE WHEN v_remaining<=0 THEN 'resolved' ELSE 'in_review' END,
      resolved_at=CASE WHEN v_remaining<=0 THEN now() ELSE NULL END,
      resolved_by=CASE WHEN v_remaining<=0 THEN auth.uid() ELSE NULL END,
      resolution_note=CASE WHEN v_remaining<=0 THEN COALESCE(NULLIF(btrim(p_resolution_note),''),'Saldo regularizado posteriormente') ELSE resolution_note END,
      updated_at=now()
    WHERE id=p_incident_id;
    RETURN jsonb_build_object('success',true,'status',CASE WHEN v_remaining<=0 THEN 'resolved' ELSE 'in_review' END,
      'pending_quantity',v_remaining,'movement_count',v_movement_count);
  END IF;

  UPDATE public.operational_incidents SET
    status='resolved',pending_quantity=0,resolved_at=now(),resolved_by=auth.uid(),
    resolution_note=COALESCE(NULLIF(btrim(p_resolution_note),''),'Resolvido pelo gestor'),updated_at=now()
  WHERE id=p_incident_id;
  RETURN jsonb_build_object('success',true,'status','resolved','movement_count',0);
END; $$;

REVOKE ALL ON FUNCTION public.report_operational_incident(text,text,text,text,uuid,uuid,numeric,numeric,text,text,uuid,jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.report_operational_incident(text,text,text,text,uuid,uuid,numeric,numeric,text,text,uuid,jsonb) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.reconcile_operational_incident(uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reconcile_operational_incident(uuid,text) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.apply_order_stock_event(uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.apply_order_stock_event(uuid,text) TO authenticated, service_role;
