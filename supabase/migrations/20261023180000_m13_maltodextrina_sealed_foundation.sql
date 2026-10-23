-- M13 — Maltodextrina: GD2-equivalent original sealed 25kg sacks vs opened grams.
-- No automatic conversion of historical 40kg of inventory.
CREATE TABLE public.maltodextrina_sealed_stock (
 storage_location_id uuid PRIMARY KEY REFERENCES public.storage_locations(id),
 sacks integer NOT NULL DEFAULT 0 CHECK(sacks>=0),
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.maltodextrina_sealed_events (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 event_key text UNIQUE NOT NULL,
 storage_location_id uuid NOT NULL REFERENCES public.storage_locations(id),
 movement_type text NOT NULL CHECK(movement_type IN ('in','out')),
 sacks integer NOT NULL CHECK(sacks>0),
 previous_balance integer NOT NULL,
 new_balance integer NOT NULL CHECK(new_balance>=0),
 reference_type text NOT NULL,
 reference_id uuid NOT NULL,
 notes text,
 created_by uuid,
 created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.maltodextrina_sealed_stock ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.maltodextrina_sealed_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY maltodextrina_stock_read ON public.maltodextrina_sealed_stock FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY maltodextrina_events_read ON public.maltodextrina_sealed_events FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
REVOKE ALL ON public.maltodextrina_sealed_stock,public.maltodextrina_sealed_events FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.maltodextrina_sealed_stock,public.maltodextrina_sealed_events TO authenticated;

CREATE OR REPLACE FUNCTION public.maltodextrina_move_sealed_internal(
 p_location_id uuid,p_delta integer,p_reference_type text,p_reference_id uuid,p_event_key text,p_notes text
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
DECLARE previous integer; next_balance integer;
BEGIN
 IF p_delta IS NULL OR p_delta=0 OR abs(p_delta)>10000 THEN RAISE EXCEPTION 'malto_invalid_delta'; END IF;
 IF nullif(btrim(p_event_key),'') IS NULL OR p_reference_id IS NULL THEN RAISE EXCEPTION 'malto_invalid_reference'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.storage_locations WHERE id=p_location_id AND is_active) THEN RAISE EXCEPTION 'malto_invalid_location'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('malto:sealed:'||p_location_id::text,0));
 IF EXISTS(SELECT 1 FROM public.maltodextrina_sealed_events WHERE event_key=p_event_key) THEN RAISE EXCEPTION 'malto_duplicate_event'; END IF;
 INSERT INTO public.maltodextrina_sealed_stock(storage_location_id,sacks) VALUES(p_location_id,0) ON CONFLICT DO NOTHING;
 SELECT sacks INTO previous FROM public.maltodextrina_sealed_stock WHERE storage_location_id=p_location_id FOR UPDATE;
 next_balance:=previous+p_delta;
 IF next_balance<0 THEN RAISE EXCEPTION 'malto_insufficient_original_sacks'; END IF;
 UPDATE public.maltodextrina_sealed_stock SET sacks=next_balance,updated_at=now() WHERE storage_location_id=p_location_id;
 INSERT INTO public.maltodextrina_sealed_events(event_key,storage_location_id,movement_type,sacks,previous_balance,new_balance,reference_type,reference_id,notes,created_by)
 VALUES(p_event_key,p_location_id,CASE WHEN p_delta>0 THEN 'in' ELSE 'out' END,abs(p_delta),previous,next_balance,p_reference_type,p_reference_id,p_notes,auth.uid());
END;$fn$;
REVOKE ALL ON FUNCTION public.maltodextrina_move_sealed_internal(uuid,integer,text,uuid,text,text) FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.maltodextrina_convert_physical_stock(
 p_direction text,p_sacks integer,p_location_id uuid,p_event_key text,p_confirmed boolean
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
DECLARE grams numeric; old_balance numeric; new_balance numeric; loc text; event_id uuid:=gen_random_uuid();
BEGIN
 IF auth.uid() IS NULL OR coalesce(public.current_app_user_role(),'') NOT IN ('Administrador','LIDER PRODUÇÃO') THEN RAISE EXCEPTION 'inventory_manager_required'; END IF;
 IF p_direction NOT IN ('open','reclassify') OR p_sacks IS NULL OR p_sacks<1 OR p_sacks>1000 OR p_confirmed IS DISTINCT FROM TRUE THEN RAISE EXCEPTION 'malto_invalid_conversion'; END IF;
 IF p_event_key IS NULL OR p_event_key !~ '^malto:[0-9a-f-]{36}$' THEN RAISE EXCEPTION 'malto_invalid_event_key'; END IF;
 SELECT name INTO loc FROM public.storage_locations WHERE id=p_location_id AND is_active;
 IF loc IS NULL THEN RAISE EXCEPTION 'malto_invalid_location'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('malto:sealed:'||p_location_id::text,0));
 IF EXISTS(SELECT 1 FROM public.maltodextrina_sealed_events WHERE event_key=p_event_key||':sacks') THEN RETURN jsonb_build_object('success',true,'already_processed',true); END IF;
 grams:=25000*p_sacks;
 INSERT INTO public.inventory(product_id,variant_id,location,location_id,quantity,updated_at)
 VALUES('78fd74e2-1dc8-4c10-94a3-e661de6f8ba8',NULL,loc,p_location_id,0,now())
 ON CONFLICT(product_id,variant_id,location) DO NOTHING;
 SELECT quantity INTO old_balance FROM public.inventory WHERE product_id='78fd74e2-1dc8-4c10-94a3-e661de6f8ba8' AND variant_id IS NULL AND location=loc FOR UPDATE;
 IF old_balance IS NULL THEN RAISE EXCEPTION 'malto_inventory_not_found'; END IF;
 IF p_direction='reclassify' THEN
   IF old_balance<grams THEN RAISE EXCEPTION 'malto_insufficient_legacy_grams'; END IF;
   PERFORM public.maltodextrina_move_sealed_internal(p_location_id,p_sacks,'malto_conversion',event_id,p_event_key||':sacks','Conferência de saco original lacrado');
   new_balance:=old_balance-grams;
 ELSE
   PERFORM public.maltodextrina_move_sealed_internal(p_location_id,-p_sacks,'malto_conversion',event_id,p_event_key||':sacks','Abertura física de saco original');
   new_balance:=old_balance+grams;
 END IF;
 UPDATE public.inventory SET quantity=new_balance,updated_at=now()
 WHERE product_id='78fd74e2-1dc8-4c10-94a3-e661de6f8ba8' AND variant_id IS NULL AND location=loc;
 INSERT INTO public.inventory_movements(product_id,variant_id,movement_type,quantity,previous_balance,new_balance,location,reference_type,reference_id,event_key,notes,created_by)
 VALUES('78fd74e2-1dc8-4c10-94a3-e661de6f8ba8',NULL,CASE WHEN p_direction='open' THEN 'in' ELSE 'out' END,grams,old_balance,new_balance,loc,'malto_physical_conversion',event_id,p_event_key||':grams','Conversão física de Maltodextrina 25kg',auth.uid()::text);
 RETURN jsonb_build_object('success',true,'already_processed',false,'sacks',p_sacks,'grams',grams,'open_grams_balance',new_balance);
END;$fn$;
REVOKE ALL ON FUNCTION public.maltodextrina_convert_physical_stock(text,integer,uuid,text,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.maltodextrina_convert_physical_stock(text,integer,uuid,text,boolean) TO authenticated;
