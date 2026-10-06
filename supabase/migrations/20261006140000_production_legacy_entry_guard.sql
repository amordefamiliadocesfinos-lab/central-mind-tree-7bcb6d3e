-- PR-B / T3 — fecha o writer legado em OPs factuais.
-- production_entries permanece preservada para OPs legacy_completion, mas não pode
-- representar novas produções cuja verdade física é production_facts.

CREATE OR REPLACE FUNCTION public.guard_production_entry_legacy_only()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  v_mode text;
BEGIN
  SELECT physical_flow_mode
    INTO v_mode
  FROM public.production_orders
  WHERE id = NEW.production_order_id;

  IF v_mode IS NULL THEN
    RAISE EXCEPTION 'production_order_not_found_for_entry';
  END IF;

  IF v_mode <> 'legacy_completion' THEN
    RAISE EXCEPTION 'production_entries_are_legacy_only';
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS production_entries_legacy_only_guard
ON public.production_entries;

CREATE TRIGGER production_entries_legacy_only_guard
BEFORE INSERT OR UPDATE ON public.production_entries
FOR EACH ROW
EXECUTE FUNCTION public.guard_production_entry_legacy_only();
