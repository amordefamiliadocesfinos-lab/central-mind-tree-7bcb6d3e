-- F6-C.2a — Unificação da autoridade de etapa comercial
-- Fonte única: contacts.funnel_status
-- service_conversations.funnel_stage é somente espelho técnico canônico.
-- Não saneia valores históricos em massa.

-- Encerra a autoridade conversation -> contact.
DROP TRIGGER IF EXISTS trg_sync_funnel_conv_to_contact
ON public.service_conversations;

-- Mantém a função histórica sem caller ativo nesta frente.
-- Não criar trigger substituto nem writer conversation -> contact.

-- O espelho contact -> conversation passa a preservar exatamente o valor
-- canônico do contato, sem tradução para lead/interested/engaged/customer.
CREATE OR REPLACE FUNCTION public.sync_funnel_contact_to_conversations()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF TG_OP = 'UPDATE'
     AND NEW.funnel_status IS NOT DISTINCT FROM OLD.funnel_status THEN
    RETURN NEW;
  END IF;

  -- Contato fora do CRM não materializa etapa comercial na conversa.
  IF NEW.funnel_status IS NULL THEN
    RETURN NEW;
  END IF;

  UPDATE public.service_conversations
     SET funnel_stage = NEW.funnel_status,
         updated_at = now()
   WHERE contact_id = NEW.id
     AND funnel_stage IS DISTINCT FROM NEW.funnel_status;

  RETURN NEW;
END;
$function$;

-- Defesa idempotente: preserva o trigger estrutural oficial caso a instalação
-- de origem esteja incompleta, sem tocar em dados históricos.
DROP TRIGGER IF EXISTS trg_sync_funnel_contact_to_conv ON public.contacts;
CREATE TRIGGER trg_sync_funnel_contact_to_conv
AFTER UPDATE OF funnel_status ON public.contacts
FOR EACH ROW
EXECUTE FUNCTION public.sync_funnel_contact_to_conversations();
