-- Uma OP passa a ser um cabeçalho operacional com N identidades físicas.
-- Os campos legados do cabeçalho permanecem: para OPs históricas e OPs de um
-- único item eles continuam espelhando o primeiro item, sem perder histórico.
CREATE TABLE IF NOT EXISTS public.production_order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  production_order_id uuid NOT NULL REFERENCES public.production_orders(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  variant_id uuid NULL REFERENCES public.product_variants(id) ON DELETE RESTRICT,
  planned_quantity numeric NOT NULL CHECK (planned_quantity > 0),
  produced_quantity numeric NOT NULL DEFAULT 0 CHECK (produced_quantity >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS production_order_items_identity_unique ON public.production_order_items(production_order_id, product_id, COALESCE(variant_id, '00000000-0000-0000-0000-000000000000'::uuid));
CREATE INDEX IF NOT EXISTS production_order_items_order_idx ON public.production_order_items(production_order_id);

-- Backfill idempotente das OPs legadas. A quantidade consolidada representa
-- produção já apontada; a meta preserva o target histórico.
INSERT INTO public.production_order_items (production_order_id, product_id, variant_id, planned_quantity, produced_quantity)
SELECT id, product_id, variant_id, target_quantity, GREATEST(COALESCE(consolidated_quantity, 0), 0)
FROM public.production_orders
WHERE product_id IS NOT NULL AND target_quantity > 0
ON CONFLICT DO NOTHING;

ALTER TABLE public.production_entries ADD COLUMN IF NOT EXISTS production_order_item_id uuid NULL REFERENCES public.production_order_items(id) ON DELETE RESTRICT;
UPDATE public.production_entries entry
SET production_order_item_id = item.id
FROM public.production_order_items item
WHERE item.production_order_id = entry.production_order_id
  AND entry.production_order_item_id IS NULL
  AND NOT EXISTS (SELECT 1 FROM public.production_order_items other WHERE other.production_order_id = entry.production_order_id AND other.id <> item.id);
CREATE INDEX IF NOT EXISTS production_entries_order_item_idx ON public.production_entries(production_order_item_id);

CREATE OR REPLACE FUNCTION public.assert_production_order_item_identity()
RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
DECLARE v_mode text;
BEGIN
  SELECT variation_mode INTO v_mode FROM public.products WHERE id=NEW.product_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Produto da OP não encontrado'; END IF;
  IF COALESCE(v_mode,'sem_variacao')='variacoes_fisicas' AND NEW.variant_id IS NULL THEN RAISE EXCEPTION 'Produto Mestre exige variante física na OP'; END IF;
  IF COALESCE(v_mode,'sem_variacao')<>'variacoes_fisicas' AND NEW.variant_id IS NOT NULL THEN RAISE EXCEPTION 'Produto simples não aceita variante na OP'; END IF;
  IF NEW.variant_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.product_variants WHERE id=NEW.variant_id AND product_id=NEW.product_id) THEN RAISE EXCEPTION 'Variante não pertence ao produto da OP'; END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS production_order_items_identity ON public.production_order_items;
CREATE TRIGGER production_order_items_identity BEFORE INSERT OR UPDATE OF product_id,variant_id ON public.production_order_items FOR EACH ROW EXECUTE FUNCTION public.assert_production_order_item_identity();
CREATE TRIGGER production_order_items_updated_at BEFORE UPDATE ON public.production_order_items FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.assert_production_entry_item()
RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
DECLARE v_items integer;
BEGIN
  SELECT count(*) INTO v_items FROM public.production_order_items WHERE production_order_id=NEW.production_order_id;
  IF v_items > 1 AND NEW.production_order_item_id IS NULL THEN RAISE EXCEPTION 'Lançamento de OP multi-item exige o item produzido'; END IF;
  IF NEW.production_order_item_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.production_order_items WHERE id=NEW.production_order_item_id AND production_order_id=NEW.production_order_id) THEN RAISE EXCEPTION 'Item não pertence à OP'; END IF;
  IF v_items=1 AND NEW.production_order_item_id IS NULL THEN SELECT id INTO NEW.production_order_item_id FROM public.production_order_items WHERE production_order_id=NEW.production_order_id; END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS production_entries_item_contract ON public.production_entries;
CREATE TRIGGER production_entries_item_contract BEFORE INSERT OR UPDATE OF production_order_id,production_order_item_id ON public.production_entries FOR EACH ROW EXECUTE FUNCTION public.assert_production_entry_item();

-- Recalcula cada item a partir dos apontamentos. A quantidade do cabeçalho é
-- mantida apenas como compatibilidade para os leitores legados de OP unitária.
CREATE OR REPLACE FUNCTION public.recalculate_production_order_item(p_item_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_order_id uuid; v_qty numeric; v_has_required_process boolean;
BEGIN
  SELECT production_order_id INTO v_order_id FROM public.production_order_items WHERE id=p_item_id FOR UPDATE;
  IF NOT FOUND THEN RETURN; END IF;
  SELECT EXISTS(SELECT 1 FROM public.production_order_processes WHERE production_order_id=v_order_id AND is_required) INTO v_has_required_process;
  IF v_has_required_process THEN
    SELECT COALESCE(min(COALESCE(entry_qty.sum_qty,0)),0) INTO v_qty
    FROM public.production_order_processes process
    LEFT JOIN (SELECT process_id,sum(quantity) sum_qty FROM public.production_entries WHERE production_order_item_id=p_item_id GROUP BY process_id) entry_qty ON entry_qty.process_id=process.process_id
    WHERE process.production_order_id=v_order_id AND process.is_required;
  ELSE
    SELECT COALESCE(min(sum_qty),0) INTO v_qty FROM (SELECT process_id,sum(quantity) sum_qty FROM public.production_entries WHERE production_order_item_id=p_item_id GROUP BY process_id) entries;
  END IF;
  UPDATE public.production_order_items SET produced_quantity=v_qty,updated_at=now() WHERE id=p_item_id;
  UPDATE public.production_orders SET consolidated_quantity=COALESCE((SELECT produced_quantity FROM public.production_order_items WHERE production_order_id=v_order_id ORDER BY created_at,id LIMIT 1),0),updated_at=now() WHERE id=v_order_id;
END; $$;

-- O apontamento é a fonte de verdade do produzido. Esses triggers cobrem UI,
-- outro cliente, RPCs e integrações futuras; não movimentam estoque nem
-- concluem OPs e não recursam porque a função não grava production_entries.
CREATE OR REPLACE FUNCTION public.sync_production_order_item_produced_quantity()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF TG_OP='DELETE' THEN
    PERFORM public.recalculate_production_order_item(OLD.production_order_item_id);
    RETURN OLD;
  END IF;
  IF TG_OP='UPDATE' AND OLD.production_order_item_id IS DISTINCT FROM NEW.production_order_item_id THEN
    PERFORM public.recalculate_production_order_item(OLD.production_order_item_id);
  END IF;
  PERFORM public.recalculate_production_order_item(NEW.production_order_item_id);
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS production_entries_sync_produced_quantity ON public.production_entries;
CREATE TRIGGER production_entries_sync_produced_quantity
  AFTER INSERT OR UPDATE OF production_order_item_id,process_id,quantity OR DELETE ON public.production_entries
  FOR EACH ROW EXECUTE FUNCTION public.sync_production_order_item_produced_quantity();

-- Conclusão multi-item: consolida todos os componentes de todos os itens,
-- bloqueia e pré-valida integralmente antes da primeira baixa, e gera uma
-- entrada acabada por identidade. Repetir uma OP concluída não duplica eventos.
CREATE OR REPLACE FUNCTION public.complete_production_order(p_production_order_id uuid,p_finished_location text DEFAULT 'Fábrica')
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_order public.production_orders; v_item record; v_component record; v_inventory record; v_available numeric; v_remaining numeric; v_take numeric; v_previous numeric; v_new numeric; v_shortages jsonb:='[]'::jsonb; v_missing_bom_items jsonb:='[]'::jsonb; v_count integer:=0; v_location text:=COALESCE(NULLIF(btrim(p_finished_location),''),'Fábrica'); v_key text;
BEGIN
  SELECT * INTO v_order FROM public.production_orders WHERE id=p_production_order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Ordem de produção não encontrada'; END IF;
  IF v_order.status='concluido' THEN RETURN jsonb_build_object('success',true,'already_completed',true,'movement_count',0,'shortages','[]'::jsonb); END IF;
  IF v_order.status='cancelado' THEN RETURN jsonb_build_object('success',false,'reason','cancelled','shortages','[]'::jsonb); END IF;
  IF NOT EXISTS (SELECT 1 FROM public.production_order_items WHERE production_order_id=v_order.id) THEN RETURN jsonb_build_object('success',false,'reason','missing_items','shortages','[]'::jsonb); END IF;
  IF EXISTS (SELECT 1 FROM public.production_order_items WHERE production_order_id=v_order.id AND produced_quantity<=0) THEN RETURN jsonb_build_object('success',false,'reason','no_produced_quantity','shortages','[]'::jsonb); END IF;
  -- Cada identidade produzida precisa ter sua própria BOM antes de qualquer
  -- movimento. Não basta haver componentes para outro item da mesma OP.
  FOR v_item IN SELECT item.id,item.product_id,item.variant_id,p.name product_name,pv.variant_name FROM public.production_order_items item JOIN public.products p ON p.id=item.product_id LEFT JOIN public.product_variants pv ON pv.id=item.variant_id WHERE item.production_order_id=v_order.id LOOP
    IF NOT EXISTS (SELECT 1 FROM public.product_components pc WHERE pc.product_id=v_item.product_id AND pc.product_variant_id IS NOT DISTINCT FROM v_item.variant_id) THEN
      v_missing_bom_items:=v_missing_bom_items||jsonb_build_array(jsonb_build_object('production_order_item_id',v_item.id,'product_id',v_item.product_id,'variant_id',v_item.variant_id,'product_name',v_item.product_name,'variant_name',v_item.variant_name));
    END IF;
  END LOOP;
  IF jsonb_array_length(v_missing_bom_items)>0 THEN RETURN jsonb_build_object('success',false,'reason','missing_bom','missing_bom_items',v_missing_bom_items,'shortages','[]'::jsonb); END IF;
  FOR v_component IN SELECT pc.component_id,pc.variant_id,sum(pc.qty_per_unit*item.produced_quantity) required_quantity,p.name component_name,pv.variant_name,COALESCE(pv.sku,p.sku) component_sku FROM public.production_order_items item JOIN public.product_components pc ON pc.product_id=item.product_id AND pc.product_variant_id IS NOT DISTINCT FROM item.variant_id JOIN public.products p ON p.id=pc.component_id LEFT JOIN public.product_variants pv ON pv.id=pc.variant_id WHERE item.production_order_id=v_order.id GROUP BY pc.component_id,pc.variant_id,p.name,pv.variant_name,p.sku,pv.sku LOOP
    v_available:=0; FOR v_inventory IN SELECT quantity FROM public.inventory WHERE product_id=v_component.component_id AND variant_id IS NOT DISTINCT FROM v_component.variant_id FOR UPDATE LOOP v_available:=v_available+v_inventory.quantity; END LOOP;
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
END; $$;

ALTER TABLE public.production_order_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users operate production_order_items" ON public.production_order_items FOR ALL TO authenticated USING (true) WITH CHECK (true);
GRANT SELECT,INSERT,UPDATE,DELETE ON public.production_order_items TO authenticated;
GRANT EXECUTE ON FUNCTION public.complete_production_order(uuid,text) TO authenticated;
