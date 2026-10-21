-- Stage 2A: atomic, on-demand closed-pack opening for Porto Gel production.
-- Dormant until stage 2B connects the factual production writers and activates new identities.
-- Old variant histories remain untouched.
CREATE OR REPLACE FUNCTION public.ensure_portogel_production_material(
 p_production_fact_id uuid, p_required_g numeric
) RETURNS numeric LANGUAGE plpgsql SECURITY INVOKER SET search_path TO 'public'
AS $function$
DECLARE
 v_product constant uuid := '6e757550-a9b6-4644-8164-8c802760e373';
 v_bulk constant uuid := 'fcf97062-683f-4921-b941-5236613c32fb';
 v_location constant text := 'Fábrica';
 v_existing numeric;
 v_short numeric;
 v_pack record;
 v_inventory record;
 v_open int;
 v_before numeric;
 v_key text;
 v_moved numeric := 0;
BEGIN
 IF p_production_fact_id IS NULL OR p_required_g IS NULL OR p_required_g < 0 THEN
   RAISE EXCEPTION 'Invalid production material request';
 END IF;
 IF NOT EXISTS (SELECT 1 FROM public.production_facts WHERE id=p_production_fact_id) THEN
   RAISE EXCEPTION 'Production fact does not exist';
 END IF;
 IF NOT EXISTS (SELECT 1 FROM public.product_variants WHERE id=v_bulk AND is_active AND unit='g') THEN
   RAISE EXCEPTION 'Porto Gel production identity is not active';
 END IF;
 -- Serialize openings for this specific product, avoiding two simultaneous facts
 -- observing the same available gram balance and opening unnecessary packages.
 PERFORM pg_advisory_xact_lock(hashtextextended(v_product::text || ':portogel_auto_open',0));
 SELECT COALESCE(sum(quantity),0) INTO v_existing
 FROM public.inventory WHERE product_id=v_product AND variant_id=v_bulk AND location=v_location;
 v_short := GREATEST(0,p_required_g-v_existing);
 IF v_short<=0 THEN RETURN 0; END IF;

 FOR v_pack IN
   SELECT * FROM (VALUES
     ('9173505d-7720-40b6-8040-84d68a3c2334'::uuid, 10000::numeric,1),
     ('5d4602ba-0db4-4095-8866-6e702fa192c5'::uuid, 3000::numeric,2),
     ('ae7c8013-de6c-4806-9450-abcab2202aa9'::uuid, 1000::numeric,3)
   ) AS priority(variant_id,grams_per_pack,sort_order)
   ORDER BY sort_order
 LOOP
   EXIT WHEN v_short<=0;
   IF NOT EXISTS (SELECT 1 FROM public.product_variants
     WHERE id=v_pack.variant_id AND is_active AND unit='un') THEN
     RAISE EXCEPTION 'Porto Gel closed-pack identity is not active: %',v_pack.variant_id;
   END IF;
   FOR v_inventory IN
     SELECT id,quantity,location FROM public.inventory
     WHERE product_id=v_product AND variant_id=v_pack.variant_id AND location=v_location
       AND quantity>=1 ORDER BY id FOR UPDATE
   LOOP
     EXIT WHEN v_short<=0;
     v_open:=LEAST(floor(v_inventory.quantity)::int,
                   ceil(v_short/v_pack.grams_per_pack)::int);
     IF v_open<1 THEN CONTINUE; END IF;
     v_key:='portogel:auto_open:'||p_production_fact_id::text||':'||v_pack.variant_id::text||':'||gen_random_uuid()::text;
     -- Unique per conversion within a locked canonical production transaction.
     UPDATE public.inventory SET quantity=quantity-v_open,updated_at=now()
       WHERE id=v_inventory.id;
     INSERT INTO public.inventory_movements
       (product_id,variant_id,movement_type,quantity,previous_balance,new_balance,
        location,reference_type,reference_id,event_key,notes)
     VALUES (v_product,v_pack.variant_id,'out',v_open,v_inventory.quantity,
             v_inventory.quantity-v_open,v_location,'portogel_auto_open',
             p_production_fact_id,v_key||':closed','Conversão automática para produção');
     INSERT INTO public.inventory(product_id,variant_id,location,quantity,updated_at)
       VALUES(v_product,v_bulk,v_location,v_open*v_pack.grams_per_pack,now())
       ON CONFLICT(product_id,variant_id,location)
       DO UPDATE SET quantity=public.inventory.quantity+EXCLUDED.quantity,updated_at=now();
     SELECT quantity-v_open*v_pack.grams_per_pack INTO v_before
       FROM public.inventory WHERE product_id=v_product AND variant_id=v_bulk AND location=v_location;
     INSERT INTO public.inventory_movements
       (product_id,variant_id,movement_type,quantity,previous_balance,new_balance,
        location,reference_type,reference_id,event_key,notes)
     VALUES (v_product,v_bulk,'in',v_open*v_pack.grams_per_pack,v_before,
             v_before+v_open*v_pack.grams_per_pack,v_location,'portogel_auto_open',
             p_production_fact_id,v_key||':bulk','Conversão automática originada de embalagem fechada');
     v_moved:=v_moved+v_open*v_pack.grams_per_pack;
     v_short:=GREATEST(0,v_short-v_open*v_pack.grams_per_pack);
   END LOOP;
 END LOOP;
 RETURN v_moved;
END;
$function$;

-- Internal-only helper; callers must use canonical security-definer production writers.
REVOKE EXECUTE ON FUNCTION public.ensure_portogel_production_material(uuid,numeric) FROM PUBLIC, anon, authenticated;
