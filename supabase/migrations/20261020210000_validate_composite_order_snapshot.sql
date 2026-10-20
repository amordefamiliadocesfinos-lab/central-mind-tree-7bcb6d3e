-- Validate the actual physical component identity, not the presentation's master,
-- when a commercial presentation is composite. Existing direct/single checks remain.
CREATE OR REPLACE FUNCTION public.validate_order_item_commercial_snapshot()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public'
AS $function$
DECLARE
  v_presentation public.commercial_presentations%ROWTYPE;
BEGIN
  IF NEW.commercial_presentation_id IS NULL THEN
    IF NEW.commercial_group_id IS NOT NULL THEN
      RAISE EXCEPTION 'Grupo comercial exige apresentação identificada.';
    END IF;
    RETURN NEW;
  END IF;

  SELECT * INTO v_presentation
  FROM public.commercial_presentations
  WHERE id = NEW.commercial_presentation_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Apresentação comercial inexistente.';
  END IF;

  IF v_presentation.composition_mode = 'composite' THEN
    IF NEW.commercial_group_id IS NULL THEN
      RAISE EXCEPTION 'Apresentação composta exige identificador de grupo.';
    END IF;
    IF NOT EXISTS (
      SELECT 1
      FROM public.commercial_presentation_components c
      JOIN public.products p ON p.id = c.product_id AND p.is_active = true
      JOIN public.product_variants v ON v.id = c.variant_id AND v.product_id = c.product_id AND v.is_active = true
      WHERE c.presentation_id = v_presentation.id
        AND c.product_id = NEW.product_id
        AND c.variant_id = NEW.variant_id
        AND NEW.commercial_conversion_factor = c.quantity
    ) THEN
      RAISE EXCEPTION 'Componente físico não pertence à composição comercial cadastrada.';
    END IF;
  ELSIF v_presentation.composition_mode = 'single' THEN
    IF NEW.commercial_group_id IS NOT NULL
       OR v_presentation.product_id IS DISTINCT FROM NEW.product_id
       OR v_presentation.variant_id IS DISTINCT FROM NEW.variant_id THEN
      RAISE EXCEPTION 'A apresentação simples não pertence à identidade física do item.';
    END IF;
  ELSE
    RAISE EXCEPTION 'Modo de composição comercial inválido.';
  END IF;
  RETURN NEW;
END;
$function$;
