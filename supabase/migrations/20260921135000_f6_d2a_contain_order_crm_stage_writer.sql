-- F6-D.2a — Contenção da autoridade Operações -> etapa CRM
-- Pedido/Operações produz fato operacional; não decide contacts.funnel_status.
-- Preserva last_purchase_date e históricos de entrega/cancelamento.
-- Não reescreve histórico existente.

CREATE OR REPLACE FUNCTION public.sync_contact_on_order_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_contact_id uuid;
BEGIN
  v_contact_id := NEW.contact_id;
  IF v_contact_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NEW;
  END IF;

  IF NEW.status IN ('entregue', 'concluido') THEN
    UPDATE public.contacts
       SET last_purchase_date = COALESCE(NEW.delivery_date, NEW.order_date, CURRENT_DATE),
           updated_at = now()
     WHERE id = v_contact_id;

    INSERT INTO public.contact_history (
      contact_id,
      event_type,
      interaction_type,
      description,
      interaction_date,
      event_metadata
    )
    VALUES (
      v_contact_id,
      'order_delivered',
      'venda',
      'Pedido ' || COALESCE(NEW.order_number, NEW.id::text) || ' entregue',
      now(),
      jsonb_build_object(
        'order_id', NEW.id,
        'order_number', NEW.order_number,
        'order_status', NEW.status
      )
    );
  ELSIF NEW.status = 'cancelado' THEN
    INSERT INTO public.contact_history (
      contact_id,
      event_type,
      interaction_type,
      description,
      interaction_date,
      event_metadata
    )
    VALUES (
      v_contact_id,
      'order_cancelled',
      'observacao',
      'Pedido ' || COALESCE(NEW.order_number, NEW.id::text) || ' cancelado',
      now(),
      jsonb_build_object(
        'order_id', NEW.id,
        'order_number', NEW.order_number,
        'order_status', NEW.status
      )
    );
  END IF;

  RETURN NEW;
END;
$function$;
