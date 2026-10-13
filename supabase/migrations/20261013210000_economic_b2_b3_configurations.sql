-- G4 — Motor Geral de Precificação: configurações econômicas B2/B3.
-- Não cria nova Apresentação Comercial. B2 é filho opcional de commercial_presentations;
-- B3 descreve preparação/fulfillment do pedido.

CREATE TABLE public.economic_cost_configurations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  block text NOT NULL CHECK (block IN ('B2', 'B3')),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  variant_id uuid REFERENCES public.product_variants(id) ON DELETE RESTRICT,
  commercial_presentation_id uuid REFERENCES public.commercial_presentations(id) ON DELETE RESTRICT,
  code text NOT NULL CHECK (btrim(code) <> ''),
  name text NOT NULL CHECK (btrim(name) <> ''),
  is_active boolean NOT NULL DEFAULT true,
  is_zero_confirmed boolean NOT NULL DEFAULT false,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX economic_cost_configurations_scope_code_unique
  ON public.economic_cost_configurations (
    block,
    product_id,
    COALESCE(variant_id, '00000000-0000-0000-0000-000000000000'::uuid),
    COALESCE(commercial_presentation_id, '00000000-0000-0000-0000-000000000000'::uuid),
    lower(btrim(code))
  );

CREATE INDEX economic_cost_configurations_lookup_idx
  ON public.economic_cost_configurations (
    block, product_id, variant_id, commercial_presentation_id, is_active
  );

CREATE TABLE public.economic_cost_configuration_components (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  configuration_id uuid NOT NULL REFERENCES public.economic_cost_configurations(id) ON DELETE CASCADE,
  component_product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  component_variant_id uuid REFERENCES public.product_variants(id) ON DELETE RESTRICT,
  subcategory text,
  quantity numeric NOT NULL CHECK (quantity > 0),
  incidence text NOT NULL CHECK (incidence IN ('I-A', 'I-P', 'I-V', 'I-H', 'I-E', 'I-Q')),
  notes text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX economic_cost_configuration_components_config_idx
  ON public.economic_cost_configuration_components (configuration_id, sort_order, id);

CREATE OR REPLACE FUNCTION public.assert_economic_cost_configuration_identity()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_product_id uuid;
  v_variant_id uuid;
BEGIN
  IF NEW.variant_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.product_variants pv
    WHERE pv.id = NEW.variant_id AND pv.product_id = NEW.product_id
  ) THEN
    RAISE EXCEPTION 'A variante da configuração econômica não pertence ao produto.';
  END IF;

  IF NEW.commercial_presentation_id IS NOT NULL THEN
    SELECT cp.product_id, cp.variant_id
      INTO v_product_id, v_variant_id
    FROM public.commercial_presentations cp
    WHERE cp.id = NEW.commercial_presentation_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Apresentação comercial não encontrada.';
    END IF;

    IF v_product_id <> NEW.product_id OR v_variant_id IS DISTINCT FROM NEW.variant_id THEN
      RAISE EXCEPTION 'Configuração econômica e apresentação comercial devem compartilhar a mesma identidade física.';
    END IF;
  END IF;

  IF NEW.block = 'B3' AND NEW.commercial_presentation_id IS NOT NULL THEN
    RAISE EXCEPTION 'B3 é configuração de fulfillment do pedido e não deve ser filha de apresentação comercial.';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER economic_cost_configuration_identity
  BEFORE INSERT OR UPDATE OF block, product_id, variant_id, commercial_presentation_id
  ON public.economic_cost_configurations
  FOR EACH ROW EXECUTE FUNCTION public.assert_economic_cost_configuration_identity();

CREATE OR REPLACE FUNCTION public.assert_economic_cost_configuration_component_identity()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.component_variant_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.product_variants pv
    WHERE pv.id = NEW.component_variant_id
      AND pv.product_id = NEW.component_product_id
  ) THEN
    RAISE EXCEPTION 'A variante do componente econômico não pertence ao produto componente.';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER economic_cost_configuration_component_identity
  BEFORE INSERT OR UPDATE OF component_product_id, component_variant_id
  ON public.economic_cost_configuration_components
  FOR EACH ROW EXECUTE FUNCTION public.assert_economic_cost_configuration_component_identity();

CREATE TRIGGER economic_cost_configurations_updated_at
  BEFORE UPDATE ON public.economic_cost_configurations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

REVOKE ALL ON public.economic_cost_configurations FROM anon;
REVOKE ALL ON public.economic_cost_configuration_components FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.economic_cost_configurations TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.economic_cost_configuration_components TO authenticated;

ALTER TABLE public.economic_cost_configurations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.economic_cost_configuration_components ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users operate economic cost configurations"
  ON public.economic_cost_configurations
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users operate economic cost configuration components"
  ON public.economic_cost_configuration_components
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Piloto Alfajor 60g. Somente configurações comprovadas/documentadas.
WITH alfajor AS (
  SELECT id FROM public.products
  WHERE lower(name) LIKE '%alfajor artesanal 60g%'
  ORDER BY updated_at DESC
  LIMIT 1
),
h18 AS (
  SELECT id FROM public.products
  WHERE lower(btrim(name)) = lower('BANDEJA H-18')
  LIMIT 1
),
rotulo AS (
  SELECT id FROM public.products
  WHERE lower(btrim(name)) = lower('ROTULO ALFAJOR PARA BANDEJA')
  LIMIT 1
),
presentations AS (
  SELECT cp.id, cp.product_id, cp.variant_id
  FROM public.commercial_presentations cp
  JOIN alfajor a ON a.id = cp.product_id
  WHERE cp.is_active = true
    AND cp.conversion_factor = 18
),
b2_h18 AS (
  INSERT INTO public.economic_cost_configurations (
    block, product_id, variant_id, commercial_presentation_id,
    code, name, is_active, is_zero_confirmed, notes
  )
  SELECT
    'B2', p.product_id, p.variant_id, p.id,
    'B2-H18', 'Bandeja H-18 + rótulo', true, false,
    'Configuração comercial documentada. Custo resolvido dinamicamente pelas fontes de aquisição/cadastro.'
  FROM presentations p
  ON CONFLICT DO NOTHING
  RETURNING id
),
b2_zero AS (
  INSERT INTO public.economic_cost_configurations (
    block, product_id, variant_id, commercial_presentation_id,
    code, name, is_active, is_zero_confirmed, notes
  )
  SELECT
    'B2', p.product_id, p.variant_id, p.id,
    'B2-SEM-ADICIONAL', 'Sem apresentação adicional', true, true,
    'Zero comprovado somente quando esta configuração for explicitamente escolhida.'
  FROM presentations p
  ON CONFLICT DO NOTHING
  RETURNING id
),
b3_zero AS (
  INSERT INTO public.economic_cost_configurations (
    block, product_id, variant_id, commercial_presentation_id,
    code, name, is_active, is_zero_confirmed, notes
  )
  SELECT
    'B3', a.id, pv.id, NULL,
    'B3-SEM-EXTRA', 'Sem embalagem extra / retirada', true, true,
    'Zero comprovado somente quando o pedido não exige preparação adicional.'
  FROM alfajor a
  JOIN public.product_variants pv ON pv.product_id = a.id AND pv.is_active = true
  ON CONFLICT DO NOTHING
  RETURNING id
)
INSERT INTO public.economic_cost_configuration_components (
  configuration_id, component_product_id, component_variant_id,
  subcategory, quantity, incidence, notes, sort_order
)
SELECT cfg.id, h18.id, NULL, 'B2.1', 1, 'I-A', 'Uma bandeja por apresentação configurada.', 10
FROM public.economic_cost_configurations cfg
JOIN presentations p ON p.id = cfg.commercial_presentation_id
CROSS JOIN h18
WHERE cfg.block = 'B2' AND cfg.code = 'B2-H18'
  AND NOT EXISTS (
    SELECT 1 FROM public.economic_cost_configuration_components ecc
    WHERE ecc.configuration_id = cfg.id AND ecc.component_product_id = h18.id
  )
UNION ALL
SELECT cfg.id, rotulo.id, NULL, 'B2.1', 1, 'I-A', 'Um rótulo por apresentação configurada.', 20
FROM public.economic_cost_configurations cfg
JOIN presentations p ON p.id = cfg.commercial_presentation_id
CROSS JOIN rotulo
WHERE cfg.block = 'B2' AND cfg.code = 'B2-H18'
  AND NOT EXISTS (
    SELECT 1 FROM public.economic_cost_configuration_components ecc
    WHERE ecc.configuration_id = cfg.id AND ecc.component_product_id = rotulo.id
  );
