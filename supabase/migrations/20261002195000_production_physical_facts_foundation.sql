-- F01.1 — Fato Real de Produção
-- Fundação estrutural sem alterar o fluxo legado de OP.

CREATE TABLE public.production_facts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  variant_id uuid NULL REFERENCES public.product_variants(id) ON DELETE RESTRICT,
  quantity numeric NOT NULL CHECK (quantity > 0),
  location text NOT NULL DEFAULT 'Fábrica',
  location_id uuid NULL REFERENCES public.storage_locations(id) ON DELETE SET NULL,
  operator_name text NULL,
  operator_user_id uuid NULL REFERENCES public.app_users(id) ON DELETE SET NULL,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  production_order_id uuid NULL REFERENCES public.production_orders(id) ON DELETE SET NULL,
  source text NOT NULL DEFAULT 'mobile' CHECK (source IN ('mobile','production_order','correction')),
  status text NOT NULL DEFAULT 'confirmed' CHECK (status IN ('confirmed','reversed')),
  event_key text NOT NULL,
  reversal_of_id uuid NULL REFERENCES public.production_facts(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NULL
);

CREATE UNIQUE INDEX production_facts_event_key_unique
  ON public.production_facts(event_key);

CREATE UNIQUE INDEX production_facts_reversal_once_unique
  ON public.production_facts(reversal_of_id)
  WHERE reversal_of_id IS NOT NULL;

CREATE INDEX production_facts_product_idx
  ON public.production_facts(product_id);

CREATE INDEX production_facts_variant_idx
  ON public.production_facts(variant_id)
  WHERE variant_id IS NOT NULL;

CREATE INDEX production_facts_production_order_idx
  ON public.production_facts(production_order_id)
  WHERE production_order_id IS NOT NULL;

CREATE INDEX production_facts_occurred_at_idx
  ON public.production_facts(occurred_at DESC);

CREATE INDEX production_facts_status_idx
  ON public.production_facts(status);

CREATE INDEX production_facts_physical_history_idx
  ON public.production_facts(product_id, variant_id, occurred_at DESC);

CREATE TRIGGER production_facts_physical_identity_check
BEFORE INSERT OR UPDATE OF product_id, variant_id
ON public.production_facts
FOR EACH ROW EXECUTE FUNCTION public.assert_operational_physical_identity();

CREATE TRIGGER production_facts_variant_matches_product
BEFORE INSERT OR UPDATE OF product_id, variant_id
ON public.production_facts
FOR EACH ROW EXECUTE FUNCTION public.assert_variant_matches_product();

CREATE TABLE public.production_fact_consumptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  production_fact_id uuid NOT NULL REFERENCES public.production_facts(id) ON DELETE RESTRICT,
  component_id uuid NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  variant_id uuid NULL REFERENCES public.product_variants(id) ON DELETE RESTRICT,
  -- Há BOMs históricas com linhas auxiliares em zero. O snapshot preserva a
  -- configuração encontrada, mas zero nunca produz movimento físico.
  qty_per_unit_snapshot numeric NOT NULL CHECK (qty_per_unit_snapshot >= 0),
  quantity_consumed numeric NOT NULL CHECK (quantity_consumed >= 0),
  unit_snapshot text NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX production_fact_consumptions_identity_unique
  ON public.production_fact_consumptions(production_fact_id, component_id, variant_id) NULLS NOT DISTINCT;

CREATE INDEX production_fact_consumptions_fact_idx
  ON public.production_fact_consumptions(production_fact_id);

CREATE INDEX production_fact_consumptions_component_idx
  ON public.production_fact_consumptions(component_id);

CREATE INDEX production_fact_consumptions_variant_idx
  ON public.production_fact_consumptions(variant_id)
  WHERE variant_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.assert_production_fact_consumption_identity()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  PERFORM public.assert_physical_identity(NEW.component_id, NEW.variant_id, TG_TABLE_NAME);
  RETURN NEW;
END;
$function$;

CREATE TRIGGER production_fact_consumptions_physical_identity_check
BEFORE INSERT OR UPDATE OF component_id, variant_id
ON public.production_fact_consumptions
FOR EACH ROW EXECUTE FUNCTION public.assert_production_fact_consumption_identity();

ALTER TABLE public.production_facts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.production_fact_consumptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users read production facts"
ON public.production_facts
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated users read production fact consumptions"
ON public.production_fact_consumptions
FOR SELECT
TO authenticated
USING (true);

GRANT SELECT ON public.production_facts TO authenticated;
GRANT SELECT ON public.production_fact_consumptions TO authenticated;
GRANT ALL ON public.production_facts TO service_role;
GRANT ALL ON public.production_fact_consumptions TO service_role;
