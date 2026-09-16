-- U5: apresentação comercial descreve uma forma de venda da mesma identidade
-- física. Não é variante e não movimenta estoque nesta etapa.

CREATE TABLE public.commercial_presentations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  variant_id uuid NULL REFERENCES public.product_variants(id) ON DELETE RESTRICT,
  name text NOT NULL CHECK (btrim(name) <> ''),
  commercial_unit_label text NOT NULL CHECK (btrim(commercial_unit_label) <> ''),
  conversion_factor numeric NOT NULL CHECK (conversion_factor > 0),
  is_active boolean NOT NULL DEFAULT true,
  notes text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX commercial_presentations_identity_name_unique
  ON public.commercial_presentations (product_id, COALESCE(variant_id, '00000000-0000-0000-0000-000000000000'::uuid), lower(btrim(name)));
CREATE INDEX commercial_presentations_identity_idx
  ON public.commercial_presentations (product_id, variant_id, is_active);

CREATE OR REPLACE FUNCTION public.assert_commercial_presentation_physical_identity()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_variation_mode text;
BEGIN
  SELECT variation_mode INTO v_variation_mode FROM public.products WHERE id = NEW.product_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Produto não encontrado para a apresentação comercial.'; END IF;
  IF COALESCE(v_variation_mode, 'sem_variacao') = 'variacoes_fisicas' AND NEW.variant_id IS NULL THEN
    RAISE EXCEPTION 'Produto Mestre exige variante física para apresentação comercial.';
  END IF;
  IF COALESCE(v_variation_mode, 'sem_variacao') <> 'variacoes_fisicas' AND NEW.variant_id IS NOT NULL THEN
    RAISE EXCEPTION 'Produto simples não aceita variante física na apresentação comercial.';
  END IF;
  IF NEW.variant_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.product_variants variant WHERE variant.id = NEW.variant_id AND variant.product_id = NEW.product_id) THEN
    RAISE EXCEPTION 'A variante informada não pertence ao produto da apresentação comercial.';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER commercial_presentations_physical_identity
  BEFORE INSERT OR UPDATE OF product_id, variant_id ON public.commercial_presentations
  FOR EACH ROW EXECUTE FUNCTION public.assert_commercial_presentation_physical_identity();
CREATE TRIGGER commercial_presentations_updated_at
  BEFORE UPDATE ON public.commercial_presentations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

REVOKE ALL ON TABLE public.commercial_presentations FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.commercial_presentations TO authenticated;
ALTER TABLE public.commercial_presentations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users operate commercial_presentations" ON public.commercial_presentations
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
