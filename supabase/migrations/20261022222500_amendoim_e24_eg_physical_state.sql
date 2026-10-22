-- AM-2 — Identidade física do Amendoim Torrado: E24 (saco ORIGINAL lacrado)
-- x EG (gramas abertas/fracionáveis). Nenhuma migração retrospectiva automática.
-- Compra futura/expedição do E24 pertencem à AM-3; esta migração não altera essas RPCs.
-- Produto Mestre c177f332-a1c7-4276-9cef-7b81af920174, 1 saco = 24.000g.
-- A conversão depende de fato físico CONFIRMADO pelo responsável do estoque.
-- Nunca inserir sacos iniciais a partir do saldo histórico de 77.344g.

CREATE TABLE IF NOT EXISTS public.amendoim_sealed_stock (
  storage_location_id uuid PRIMARY KEY REFERENCES public.storage_locations(id),
  sacks integer NOT NULL DEFAULT 0 CHECK(sacks>=0),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.amendoim_sealed_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_key text NOT NULL UNIQUE,
  storage_location_id uuid NOT NULL REFERENCES public.storage_locations(id),
  movement_type text NOT NULL CHECK(movement_type IN ('in','out')),
  sacks integer NOT NULL CHECK(sacks>0),
  previous_balance integer NOT NULL CHECK(previous_balance>=0),
  new_balance integer NOT NULL CHECK(new_balance>=0),
  grams_delta numeric NOT NULL,
  grams_previous numeric NOT NULL,
  grams_new numeric NOT NULL CHECK(grams_new>=0),
  reference_type text NOT NULL CHECK(reference_type IN ('amendoim_legacy_reclassify','amendoim_physical_open')),
  reference_id uuid NOT NULL,
  notes text,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT am2_conservation CHECK (
    (movement_type='in' AND grams_delta=-sacks*24000) OR
    (movement_type='out' AND grams_delta=sacks*24000)
  )
);
CREATE INDEX IF NOT EXISTS idx_am2_events_reference ON public.amendoim_sealed_events(reference_type,reference_id);

ALTER TABLE public.amendoim_sealed_stock ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.amendoim_sealed_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS am2_stock_read ON public.amendoim_sealed_stock;
DROP POLICY IF EXISTS am2_events_read ON public.amendoim_sealed_events;
CREATE POLICY am2_stock_read ON public.amendoim_sealed_stock FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) IS NOT NULL);
CREATE POLICY am2_events_read ON public.amendoim_sealed_events FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) IS NOT NULL);
REVOKE ALL ON public.amendoim_sealed_stock,public.amendoim_sealed_events FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.amendoim_sealed_stock,public.amendoim_sealed_events TO authenticated;

CREATE OR REPLACE FUNCTION public.amendoim_convert_physical_stock(
  p_direction text,p_sacks integer,p_location_id uuid,p_event_key text,p_confirmed boolean
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $am2$
DECLARE
  v_product constant uuid:='c177f332-a1c7-4276-9cef-7b81af920174'::uuid;
  v_actor uuid;
  v_location text;
  v_prev_sacks integer;
  v_after_sacks integer;
  v_prev_grams numeric;
  v_after_grams numeric;
  v_delta numeric;
  v_reference uuid:=gen_random_uuid();
  v_ref_type text;
BEGIN
  v_actor:=auth.uid();
  IF v_actor IS NULL OR p_confirmed IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'am2_physical_fact_requires_authenticated_confirmation';
  END IF;
  IF p_direction IS NULL OR p_direction NOT IN ('reclassify','open')
    OR p_sacks IS NULL OR p_sacks < 1 OR p_sacks > 100 THEN
    RAISE EXCEPTION 'am2_invalid_direction_or_whole_sack_count';
  END IF;
  IF p_event_key IS NULL OR length(p_event_key)>180
    OR p_event_key !~ '^amendoim:[0-9a-fA-F-]{36}$' THEN
    RAISE EXCEPTION 'am2_unique_event_key_required';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.products
    WHERE id=v_product AND is_active AND unit='g' AND variation_mode='sem_variacao'
  ) THEN RAISE EXCEPTION 'am2_physical_master_invalid'; END IF;

  SELECT name INTO v_location FROM public.storage_locations
    WHERE id=p_location_id AND is_active;
  IF v_location IS NULL THEN RAISE EXCEPTION 'am2_active_location_required';END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('am2:location:'||p_location_id::text,0));

  IF EXISTS(SELECT 1 FROM public.amendoim_sealed_events
      WHERE event_key=p_event_key||':sacks')
    OR EXISTS(SELECT 1 FROM public.inventory_movements
      WHERE event_key=p_event_key||':grams') THEN
    RAISE EXCEPTION 'am2_event_already_applied';
  END IF;

  -- All operations use exactly the SAME physical location and one transaction.
  INSERT INTO public.amendoim_sealed_stock(storage_location_id,sacks)
    VALUES(p_location_id,0) ON CONFLICT(storage_location_id) DO NOTHING;
  SELECT sacks INTO v_prev_sacks FROM public.amendoim_sealed_stock
    WHERE storage_location_id=p_location_id FOR UPDATE;

  INSERT INTO public.inventory(product_id,variant_id,location,location_id,quantity,updated_at)
    VALUES(v_product,NULL,v_location,p_location_id,0,now())
    ON CONFLICT(product_id,variant_id,location) DO NOTHING;
  SELECT quantity INTO v_prev_grams FROM public.inventory
    WHERE product_id=v_product AND variant_id IS NULL AND location=v_location
    FOR UPDATE;

  IF p_direction='reclassify' THEN
    -- Explicit physical inventory: only sealed sacks actually found INSIDE legacy grams.
    v_delta:=-p_sacks*24000;
    IF v_prev_grams < -v_delta THEN
      RAISE EXCEPTION 'am2_insufficient_legacy_grams: needed %, available %',
        -v_delta,v_prev_grams;
    END IF;
    v_after_sacks:=v_prev_sacks+p_sacks;
    v_ref_type:='amendoim_legacy_reclassify';
  ELSE
    -- A real physical opening has occurred; one full sack becomes 24.000g EG.
    v_delta:=p_sacks*24000;
    IF v_prev_sacks < p_sacks THEN
      RAISE EXCEPTION 'am2_insufficient_closed_sacks: needed %, available %',
        p_sacks,v_prev_sacks;
    END IF;
    v_after_sacks:=v_prev_sacks-p_sacks;
    v_ref_type:='amendoim_physical_open';
  END IF;
  v_after_grams:=v_prev_grams+v_delta;
  IF v_after_grams < 0 OR (v_prev_sacks*24000+v_prev_grams)
     <> (v_after_sacks*24000+v_after_grams) THEN
    RAISE EXCEPTION 'am2_total_material_conservation_failed';
  END IF;

  UPDATE public.amendoim_sealed_stock SET sacks=v_after_sacks,updated_at=now()
    WHERE storage_location_id=p_location_id;
  UPDATE public.inventory SET quantity=v_after_grams,updated_at=now()
    WHERE product_id=v_product AND variant_id IS NULL AND location=v_location;

  INSERT INTO public.amendoim_sealed_events(
    event_key,storage_location_id,movement_type,sacks,previous_balance,new_balance,
    grams_delta,grams_previous,grams_new,reference_type,reference_id,notes,created_by
  ) VALUES(
    p_event_key||':sacks',p_location_id,
    CASE WHEN p_direction='open' THEN 'out' ELSE 'in' END,
    p_sacks,v_prev_sacks,v_after_sacks,v_delta,v_prev_grams,v_after_grams,
    v_ref_type,v_reference,
    CASE WHEN p_direction='open'
      THEN 'Abertura física confirmada de embalagem original E24: libera EG.'
      ELSE 'Inventário físico confirmado: reserva como E24 fechado uma parte dos gramas legados.' END,
    v_actor
  );
  INSERT INTO public.inventory_movements (
    product_id,variant_id,movement_type,quantity,previous_balance,new_balance,
    location,reference_type,reference_id,event_key,notes,created_by
  ) VALUES (
    v_product,NULL,CASE WHEN v_delta>0 THEN 'in' ELSE 'out' END,
    abs(v_delta),v_prev_grams,v_after_grams,v_location,v_ref_type,v_reference,
    p_event_key||':grams','Par E24/EG da conversão física auditável',v_actor::text
  );

  RETURN jsonb_build_object('success',true,'location_id',p_location_id,
    'direction',p_direction,'sacks_moved',p_sacks,
    'sealed_sacks',v_after_sacks,'open_grams',v_after_grams,
    'reference_id',v_reference,'event_key',p_event_key);
END;
$am2$;

REVOKE ALL ON FUNCTION public.amendoim_convert_physical_stock(text,integer,uuid,text,boolean)
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.amendoim_convert_physical_stock(text,integer,uuid,text,boolean)
  TO authenticated;

-- AM-2 DOES NOT insert any balances, call conversion, rewrite receipt/production/order
-- functions, create marketplace listing, or manipulate historic consumption.
