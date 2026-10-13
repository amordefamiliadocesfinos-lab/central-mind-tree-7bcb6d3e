-- G4: B2 presentation configuration + B3 fulfillment configuration.
-- Extends commercial_presentations without creating a competing presentation master.

CREATE TABLE public.economic_presentation_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  variant_id uuid NULL REFERENCES public.product_variants(id) ON DELETE RESTRICT,
  commercial_presentation_id uuid NULL REFERENCES public.commercial_presentations(id) ON DELETE CASCADE,
  code text NOT NULL CHECK (btrim(code) <> ''),
  name text NOT NULL CHECK (btrim(name) <> ''),
  is_default boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  zero_confirmed boolean NOT NULL DEFAULT false,
  notes text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX economic_presentation_configs_identity_code_unique
  ON public.economic_presentation_configs (
    product_id,
    COALESCE(variant_id, '00000000-0000-0000-0000-000000000000'::uuid),
    COALESCE(commercial_presentation_id, '00000000-0000-0000-0000-000000000000'::uuid),
    lower(btrim(code))
  );

CREATE INDEX economic_presentation_configs_lookup_idx
  ON public.economic_presentation_configs (product_id, variant_id, commercial_presentation_id, is_active, is_default);

CREATE TABLE public.economic_presentation_config_components (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id uuid NOT NULL REFERENCES public.economic_presentation_configs(id) ON DELETE CASCADE,
  component_product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  component_variant_id uuid NULL REFERENCES public.product_variants(id) ON DELETE RESTRICT,
  quantity numeric NOT NULL CHECK (quantity > 0),
  notes text NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX economic_presentation_config_components_config_idx
  ON public.economic_presentation_config_components (config_id);

CREATE TABLE public.economic_fulfillment_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL CHECK (btrim(code) <> ''),
  name text NOT NULL CHECK (btrim(name) <> ''),
  is_default boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  zero_confirmed boolean NOT NULL DEFAULT false,
  notes text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX economic_fulfillment_configs_code_unique
  ON public.economic_fulfillment_configs (lower(btrim(code)));

CREATE TABLE public.economic_fulfillment_config_components (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id uuid NOT NULL REFERENCES public.economic_fulfillment_configs(id) ON DELETE CASCADE,
  component_product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  component_variant_id uuid NULL REFERENCES public.product_variants(id) ON DELETE RESTRICT,
  quantity numeric NOT NULL CHECK (quantity > 0),
  incidence text NOT NULL DEFAULT 'I-P' CHECK (incidence IN ('I-P','I-V','I-H','I-Q')),
  native_grain text NULL,
  notes text NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX economic_fulfillment_config_components_config_idx
  ON public.economic_fulfillment_config_components (config_id);

CREATE OR REPLACE FUNCTION public.assert_economic_presentation_config_identity()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_presentation public.commercial_presentations%ROWTYPE;
BEGIN
  IF NEW.commercial_presentation_id IS NOT NULL THEN
    SELECT * INTO v_presentation
      FROM public.commercial_presentations
      WHERE id = NEW.commercial_presentation_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Apresentação comercial não encontrada.';
    END IF;

    IF v_presentation.product_id <> NEW.product_id
       OR v_presentation.variant_id IS DISTINCT FROM NEW.variant_id THEN
      RAISE EXCEPTION 'Configuração B2 não corresponde à identidade da apresentação comercial.';
    END IF;
  END IF;

  IF NEW.variant_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.product_variants pv
    WHERE pv.id = NEW.variant_id AND pv.product_id = NEW.product_id
  ) THEN
    RAISE EXCEPTION 'Variante B2 não pertence ao produto.';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER economic_presentation_configs_identity
  BEFORE INSERT OR UPDATE OF product_id, variant_id, commercial_presentation_id
  ON public.economic_presentation_configs
  FOR EACH ROW EXECUTE FUNCTION public.assert_economic_presentation_config_identity();

CREATE TRIGGER economic_presentation_configs_updated_at
  BEFORE UPDATE ON public.economic_presentation_configs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER economic_fulfillment_configs_updated_at
  BEFORE UPDATE ON public.economic_fulfillment_configs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

REVOKE ALL ON TABLE public.economic_presentation_configs FROM anon;
REVOKE ALL ON TABLE public.economic_presentation_config_components FROM anon;
REVOKE ALL ON TABLE public.economic_fulfillment_configs FROM anon;
REVOKE ALL ON TABLE public.economic_fulfillment_config_components FROM anon;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.economic_presentation_configs TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.economic_presentation_config_components TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.economic_fulfillment_configs TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.economic_fulfillment_config_components TO authenticated;

ALTER TABLE public.economic_presentation_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.economic_presentation_config_components ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.economic_fulfillment_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.economic_fulfillment_config_components ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users operate economic_presentation_configs"
  ON public.economic_presentation_configs FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users operate economic_presentation_config_components"
  ON public.economic_presentation_config_components FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users operate economic_fulfillment_configs"
  ON public.economic_fulfillment_configs FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users operate economic_fulfillment_config_components"
  ON public.economic_fulfillment_config_components FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Alfajor 60g / Bandeja com 18: B2 H-18 current operational configuration.
INSERT INTO public.economic_presentation_configs (
  product_id, variant_id, commercial_presentation_id, code, name, is_default, zero_confirmed, notes
)
SELECT cp.product_id, cp.variant_id, cp.id, 'BANDEJA_H18', 'Bandeja H-18', true, false,
       'Configuração B2 piloto: 1 bandeja H-18 + 1 rótulo por apresentação de 18.'
FROM public.commercial_presentations cp
WHERE cp.product_id = '62cf9f63-be04-4261-ad11-569028dd1125'::uuid
  AND cp.conversion_factor = 18
  AND cp.is_active
ON CONFLICT DO NOTHING;

INSERT INTO public.economic_presentation_config_components (
  config_id, component_product_id, component_variant_id, quantity, notes
)
SELECT cfg.id, component.id, NULL, 1, 'Componente B2 da apresentação H-18.'
FROM public.economic_presentation_configs cfg
JOIN public.products component ON component.id IN (
  '6f7cc784-c4d5-4dfd-b473-5e4c7e080e3e'::uuid,
  '11efa210-36fd-4545-8d66-57b9e6c54aed'::uuid
)
WHERE cfg.product_id = '62cf9f63-be04-4261-ad11-569028dd1125'::uuid
  AND cfg.code = 'BANDEJA_H18'
ON CONFLICT DO NOTHING;

-- B3 initial proven-zero configuration. Other shipping compositions remain open
-- until their real material/use pattern is defined.
INSERT INTO public.economic_fulfillment_configs (
  code, name, is_default, zero_confirmed, notes
)
VALUES (
  'SEM_EMBALAGEM_EXTRA',
  'Sem embalagem extra',
  true,
  true,
  'B3 = R$0,00 only when this configuration is explicitly selected and no additional fulfillment material/labor is required.'
)
ON CONFLICT DO NOTHING;
