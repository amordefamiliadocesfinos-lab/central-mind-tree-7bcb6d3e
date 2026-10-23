-- ET1-A — Embalagem para Trufa: fundação P100 (pacote ORIGINAL fechado)
-- versus EA (unidades avulsas). Esta fase NÃO conecta recebimento,
-- produção ou expedição automaticamente; não converte inventário legado.
-- Produto Mestre canônico: af7fe3c4-863c-4d1f-9fcd-b4ecb92e5322.
-- Somente implantar após revisão e validações da frente ET1 completa.

CREATE TABLE IF NOT EXISTS public.trufa_pack_sealed_stock (
  variant_id uuid NOT NULL REFERENCES public.product_variants(id),
  storage_location_id uuid NOT NULL REFERENCES public.storage_locations(id),
  packs integer NOT NULL DEFAULT 0 CHECK (packs >= 0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (variant_id, storage_location_id)
);

CREATE TABLE IF NOT EXISTS public.trufa_pack_sealed_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_key text NOT NULL UNIQUE,
  variant_id uuid NOT NULL REFERENCES public.product_variants(id),
  storage_location_id uuid NOT NULL REFERENCES public.storage_locations(id),
  direction text NOT NULL CHECK (direction IN ('reclassify','open')),
  packs integer NOT NULL CHECK (packs > 0),
  packs_before integer NOT NULL CHECK (packs_before >= 0),
  packs_after integer NOT NULL CHECK (packs_after >= 0),
  units_before numeric NOT NULL CHECK (units_before >= 0),
  units_after numeric NOT NULL CHECK (units_after >= 0),
  reference_id uuid NOT NULL,
  actor_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT trufa_pack_mass_conservation CHECK (
    (direction='reclassify' AND packs_after=packs_before+packs
      AND units_after=units_before-100*packs)
    OR
    (direction='open' AND packs_after=packs_before-packs
      AND units_after=units_before+100*packs)
  )
);

CREATE INDEX IF NOT EXISTS idx_trufa_pack_events_location
  ON public.trufa_pack_sealed_events(storage_location_id,variant_id,created_at DESC);

ALTER TABLE public.trufa_pack_sealed_stock ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trufa_pack_sealed_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS trufa_pack_stock_read ON public.trufa_pack_sealed_stock;
DROP POLICY IF EXISTS trufa_pack_events_read ON public.trufa_pack_sealed_events;
CREATE POLICY trufa_pack_stock_read ON public.trufa_pack_sealed_stock
  FOR SELECT TO authenticated USING ((SELECT auth.uid()) IS NOT NULL);
CREATE POLICY trufa_pack_events_read ON public.trufa_pack_sealed_events
  FOR SELECT TO authenticated USING ((SELECT auth.uid()) IS NOT NULL);
REVOKE ALL ON public.trufa_pack_sealed_stock,public.trufa_pack_sealed_events
  FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.trufa_pack_sealed_stock,public.trufa_pack_sealed_events
  TO authenticated;

-- Um único evento administrativo por local/sabor, sempre com evidência física.
-- Reclassify é permitido SOMENTE após contagem dos pacotes lacrados.
-- Open é somente para pacotes realmente abertos (uso administrativo).
-- O futuro consumo automático será acoplado em outra etapa após testes.
CREATE OR REPLACE FUNCTION public.trufa_pack_convert_physical_stock(
  p_direction text,p_variant_id uuid,p_packs integer,p_location_id uuid,
  p_event_key text,p_physically_confirmed boolean
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $et1$
DECLARE
  v_master constant uuid := 'af7fe3c4-863c-4d1f-9fcd-b4ecb92e5322'::uuid;
  v_actor uuid := auth.uid();
  v_loc text;
  v_before integer;
  v_after integer;
  v_units_before numeric;
  v_units_after numeric;
  v_reference uuid := gen_random_uuid();
  v_units_delta numeric;
BEGIN
  IF v_actor IS NULL OR p_physically_confirmed IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'et1_auth_and_physical_confirmation_required';
  END IF;
  IF p_direction NOT IN ('reclassify','open') OR p_direction IS NULL
     OR p_packs IS NULL OR p_packs < 1 OR p_packs > 10000 THEN
    RAISE EXCEPTION 'et1_invalid_direction_or_pack_count';
  END IF;
  IF p_event_key IS NULL OR p_event_key !~ '^trufa-pack:[0-9a-fA-F-]{36}$' THEN
    RAISE EXCEPTION 'et1_unique_event_key_required';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.product_variants
    WHERE id=p_variant_id AND product_id=v_master AND is_active AND unit='un'
  ) THEN
    RAISE EXCEPTION 'et1_unknown_or_inactive_packaging_flavor';
  END IF;
  SELECT name INTO v_loc FROM public.storage_locations
    WHERE id=p_location_id AND is_active;
  IF v_loc IS NULL THEN RAISE EXCEPTION 'et1_active_location_required'; END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(
    'et1:pack:'||p_location_id::text||':'||p_variant_id::text,0));
  IF EXISTS (SELECT 1 FROM public.trufa_pack_sealed_events
             WHERE event_key=p_event_key||':sealed')
     OR EXISTS (SELECT 1 FROM public.inventory_movements
                WHERE event_key=p_event_key||':units') THEN
    RAISE EXCEPTION 'et1_event_already_applied';
  END IF;
  INSERT INTO public.trufa_pack_sealed_stock(variant_id,storage_location_id,packs)
  VALUES(p_variant_id,p_location_id,0) ON CONFLICT DO NOTHING;
  SELECT packs INTO v_before FROM public.trufa_pack_sealed_stock
    WHERE variant_id=p_variant_id AND storage_location_id=p_location_id FOR UPDATE;

  INSERT INTO public.inventory(product_id,variant_id,location,location_id,quantity,updated_at)
    VALUES(v_master,p_variant_id,v_loc,p_location_id,0,now())
    ON CONFLICT(product_id,variant_id,location) DO NOTHING;
  SELECT quantity INTO v_units_before FROM public.inventory
    WHERE product_id=v_master AND variant_id=p_variant_id AND location=v_loc FOR UPDATE;
  IF v_units_before IS NULL THEN RAISE EXCEPTION 'et1_inventory_row_missing'; END IF;

  IF p_direction='reclassify' THEN
    IF v_units_before < p_packs*100 THEN
      RAISE EXCEPTION 'et1_insufficient_legacy_units_for_reclassification';
    END IF;
    v_after := v_before+p_packs;
    v_units_delta := -100*p_packs;
  ELSE
    IF v_before < p_packs THEN RAISE EXCEPTION 'et1_insufficient_sealed_packs'; END IF;
    v_after := v_before-p_packs;
    v_units_delta := 100*p_packs;
  END IF;
  v_units_after := v_units_before+v_units_delta;
  IF v_before*100+v_units_before <> v_after*100+v_units_after THEN
    RAISE EXCEPTION 'et1_total_units_not_conserved';
  END IF;

  UPDATE public.trufa_pack_sealed_stock SET packs=v_after,updated_at=now()
    WHERE variant_id=p_variant_id AND storage_location_id=p_location_id;
  UPDATE public.inventory SET quantity=v_units_after,updated_at=now()
    WHERE product_id=v_master AND variant_id=p_variant_id AND location=v_loc;

  INSERT INTO public.trufa_pack_sealed_events(
    event_key,variant_id,storage_location_id,direction,packs,packs_before,packs_after,
    units_before,units_after,reference_id,actor_id
  ) VALUES (p_event_key||':sealed',p_variant_id,p_location_id,p_direction,p_packs,
    v_before,v_after,v_units_before,v_units_after,v_reference,v_actor);

  INSERT INTO public.inventory_movements(product_id,variant_id,movement_type,quantity,
    previous_balance,new_balance,location,reference_type,reference_id,event_key,notes,created_by)
  VALUES(v_master,p_variant_id,CASE WHEN v_units_delta>0 THEN 'in' ELSE 'out' END,
    abs(v_units_delta),v_units_before,v_units_after,v_loc,
    'trufa_pack_physical_conversion',v_reference,p_event_key||':units',
    'ET1 conversão P100/EA por sabor, mediante conferência física',v_actor::text);

  RETURN jsonb_build_object('success',true,'flavor_variant_id',p_variant_id,
    'location_id',p_location_id,'sealed_packs',v_after,'loose_units',v_units_after,
    'event_key',p_event_key,'reference_id',v_reference);
END;$et1$;
REVOKE ALL ON FUNCTION public.trufa_pack_convert_physical_stock(text,uuid,integer,uuid,text,boolean)
  FROM PUBLIC,anon,authenticated;
-- Não conceder EXECUTE antes do gerenciador administrativo e dos testes ET1.
-- NÃO executar função em dados históricos sem conferência do operador.
