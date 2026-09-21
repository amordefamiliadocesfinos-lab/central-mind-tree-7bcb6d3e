-- F6-I — pagamentos financeiros deixam de fabricar histórico CRM paralelo
-- e passam a manter apenas projeções financeiras idempotentes do contato.

CREATE OR REPLACE FUNCTION public.recalculate_contact_payment_metrics(p_contact_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_lifetime_value numeric(20,10) := 0;
  v_paid_orders_count integer := 0;
  v_last_payment_date date := NULL;
BEGIN
  IF p_contact_id IS NULL THEN
    RETURN;
  END IF;

  WITH paid_entries AS (
    SELECT
      fe.id,
      fe.order_id,
      fe.value,
      max(fm.movement_date) AS paid_at,
      sum(fm.value) AS total_paid
    FROM public.financial_entries fe
    JOIN public.orders o
      ON o.id = fe.order_id
     AND o.contact_id = p_contact_id
    JOIN public.financial_movements fm
      ON fm.entry_id = fe.id
    WHERE fe.type = 'receber'
      AND fe.order_id IS NOT NULL
    GROUP BY fe.id, fe.order_id, fe.value
    HAVING sum(fm.value) >= fe.value
  ), paid_orders AS (
    SELECT
      order_id,
      sum(value) AS order_value,
      max(paid_at) AS paid_at
    FROM paid_entries
    GROUP BY order_id
  )
  SELECT
    COALESCE(sum(order_value), 0),
    count(*)::integer,
    max(paid_at)
  INTO v_lifetime_value, v_paid_orders_count, v_last_payment_date
  FROM paid_orders;

  UPDATE public.contacts
  SET lifetime_value = v_lifetime_value,
      paid_orders_count = v_paid_orders_count,
      last_payment_date = v_last_payment_date,
      client_classification = CASE
        WHEN v_paid_orders_count >= 5 THEN 'vip'
        ELSE client_classification
      END,
      updated_at = now()
  WHERE id = p_contact_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.sync_contact_on_payment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_entry_id uuid;
  v_old_entry_id uuid;
  v_contact_id uuid;
  v_old_contact_id uuid;
BEGIN
  v_entry_id := CASE WHEN TG_OP = 'DELETE' THEN NULL ELSE NEW.entry_id END;
  v_old_entry_id := CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE OLD.entry_id END;

  IF v_entry_id IS NOT NULL THEN
    SELECT o.contact_id
      INTO v_contact_id
    FROM public.financial_entries fe
    JOIN public.orders o ON o.id = fe.order_id
    WHERE fe.id = v_entry_id
      AND fe.type = 'receber';

    PERFORM public.recalculate_contact_payment_metrics(v_contact_id);
  END IF;

  IF v_old_entry_id IS NOT NULL AND v_old_entry_id IS DISTINCT FROM v_entry_id THEN
    SELECT o.contact_id
      INTO v_old_contact_id
    FROM public.financial_entries fe
    JOIN public.orders o ON o.id = fe.order_id
    WHERE fe.id = v_old_entry_id
      AND fe.type = 'receber';

    PERFORM public.recalculate_contact_payment_metrics(v_old_contact_id);
  ELSIF TG_OP = 'DELETE' AND v_old_entry_id IS NOT NULL THEN
    SELECT o.contact_id
      INTO v_old_contact_id
    FROM public.financial_entries fe
    JOIN public.orders o ON o.id = fe.order_id
    WHERE fe.id = v_old_entry_id
      AND fe.type = 'receber';

    PERFORM public.recalculate_contact_payment_metrics(v_old_contact_id);
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_sync_contact_on_payment ON public.financial_movements;
CREATE TRIGGER trg_sync_contact_on_payment
AFTER INSERT OR UPDATE OR DELETE ON public.financial_movements
FOR EACH ROW
EXECUTE FUNCTION public.sync_contact_on_payment();
