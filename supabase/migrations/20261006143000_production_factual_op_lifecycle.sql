-- PR-C / T4 — ciclo factual de OP.
-- production_facts é a execução física; a OP apenas acompanha e fecha planejamento.

CREATE OR REPLACE FUNCTION public.advance_factual_production_order_from_fact()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.production_order_id IS NOT NULL AND NEW.status = 'confirmed' THEN
    UPDATE public.production_orders
    SET status = 'producao',
        updated_at = now()
    WHERE id = NEW.production_order_id
      AND physical_flow_mode = 'production_facts'
      AND status = 'aberto';
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS production_facts_advance_order
ON public.production_facts;

CREATE TRIGGER production_facts_advance_order
AFTER INSERT ON public.production_facts
FOR EACH ROW
EXECUTE FUNCTION public.advance_factual_production_order_from_fact();

CREATE OR REPLACE FUNCTION public.guard_factual_production_order_completion()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  v_planned numeric := 0;
  v_produced numeric := 0;
BEGIN
  IF NEW.status = 'concluido'
     AND OLD.status IS DISTINCT FROM 'concluido'
     AND NEW.physical_flow_mode = 'production_facts' THEN

    SELECT COALESCE(sum(planned_quantity), 0)
      INTO v_planned
    FROM public.production_order_items
    WHERE production_order_id = NEW.id;

    IF v_planned <= 0 THEN
      v_planned := COALESCE(NEW.target_quantity, 0);
    END IF;

    SELECT COALESCE(sum(quantity), 0)
      INTO v_produced
    FROM public.production_facts
    WHERE production_order_id = NEW.id
      AND status = 'confirmed';

    IF v_produced < v_planned THEN
      RAISE EXCEPTION 'production_order_incomplete planned=% produced=% remaining=%',
        v_planned, v_produced, GREATEST(v_planned - v_produced, 0);
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS production_orders_factual_completion_guard
ON public.production_orders;

CREATE TRIGGER production_orders_factual_completion_guard
BEFORE UPDATE OF status ON public.production_orders
FOR EACH ROW
EXECUTE FUNCTION public.guard_factual_production_order_completion();
