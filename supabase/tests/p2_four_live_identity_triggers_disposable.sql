-- PostgreSQL 17 ephemeral CI ONLY. Selected existing LIVE trigger semantics
-- transcribed from read-only pg_get_functiondef/pg_get_triggerdef (2026-11-05).
-- Applies to disposable synthetic tables; NEVER run in Lovable production.
-- Purpose: exercise candidate P2 against actual physical identity rules.
DROP INDEX IF EXISTS public.inventory_synthetic_identity;
ALTER TABLE public.inventory
  ADD CONSTRAINT p2_inventory_live_nulls_not_distinct
  UNIQUE NULLS NOT DISTINCT(product_id,variant_id,location);
CREATE OR REPLACE FUNCTION public.assert_physical_identity(
 p_product_id uuid,p_variant_id uuid,p_context text
) RETURNS void LANGUAGE plpgsql STABLE SET search_path TO 'public'
AS $function$
DECLARE v_mode text;v_variant_product uuid;
BEGIN
 SELECT variation_mode INTO v_mode FROM public.products WHERE id=p_product_id;
 IF v_mode IS NULL THEN RAISE EXCEPTION 'Produto físico não encontrado para %.',p_context;END IF;
 IF v_mode='sem_variacao' AND p_variant_id IS NOT NULL
 THEN RAISE EXCEPTION 'Produto simples não aceita variante em %.',p_context;END IF;
 IF v_mode='variacoes_fisicas' AND p_variant_id IS NULL
 THEN RAISE EXCEPTION 'Produto Mestre exige variante física em %.',p_context;END IF;
 IF p_variant_id IS NOT NULL THEN
  SELECT product_id INTO v_variant_product FROM public.product_variants WHERE id=p_variant_id;
  IF v_variant_product IS DISTINCT FROM p_product_id
  THEN RAISE EXCEPTION 'A variante não pertence ao produto em %.',p_context;END IF;
 END IF;
END;$function$;
CREATE OR REPLACE FUNCTION public.assert_operational_physical_identity()
 RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public'
AS $function$
BEGIN
 PERFORM public.assert_physical_identity(NEW.product_id,NEW.variant_id,TG_TABLE_NAME);
 RETURN NEW;
END;$function$;
CREATE OR REPLACE FUNCTION public.assert_variant_matches_product()
 RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public'
AS $function$
BEGIN
 IF NEW.variant_id IS NOT NULL AND NOT EXISTS (
  SELECT 1 FROM public.product_variants v
  WHERE v.id=NEW.variant_id AND v.product_id=NEW.product_id
 ) THEN RAISE EXCEPTION 'A variante % não pertence ao produto mestre %.',
 NEW.variant_id,NEW.product_id;END IF;
 RETURN NEW;
END;$function$;
CREATE TRIGGER inventory_physical_identity_check
 BEFORE INSERT OR UPDATE OF product_id,variant_id ON public.inventory
 FOR EACH ROW EXECUTE FUNCTION public.assert_operational_physical_identity();
CREATE TRIGGER inventory_variant_matches_product
 BEFORE INSERT OR UPDATE OF product_id,variant_id ON public.inventory
 FOR EACH ROW EXECUTE FUNCTION public.assert_variant_matches_product();
CREATE TRIGGER inventory_movement_variant_matches_product
 BEFORE INSERT OR UPDATE OF product_id,variant_id ON public.inventory_movements
 FOR EACH ROW EXECUTE FUNCTION public.assert_variant_matches_product();
CREATE TRIGGER inventory_movements_physical_identity_check
 BEFORE INSERT OR UPDATE OF product_id,variant_id ON public.inventory_movements
 FOR EACH ROW EXECUTE FUNCTION public.assert_operational_physical_identity();
