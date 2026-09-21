-- F6-H — service_conversations.funnel_stage é espelho técnico exato de contacts.funnel_status.
-- A criação automática de conversa não pode reintroduzir o mapeamento legado/losssy.

CREATE OR REPLACE FUNCTION public.auto_create_service_conversation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_handle text;
  v_stage text;
BEGIN
  IF NEW.is_active = false OR NEW.funnel_status IS NULL THEN
    RETURN NEW;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.service_conversations
    WHERE contact_id = NEW.id
  ) THEN
    RETURN NEW;
  END IF;

  -- F6-H: espelho canônico direto. Não traduzir/colapsar etapas CRM.
  v_stage := NEW.funnel_status;

  IF v_stage IS NULL THEN
    RETURN NEW;
  END IF;

  v_handle := COALESCE(
    NULLIF(regexp_replace(coalesce(NEW.whatsapp, ''), '\D', '', 'g'), ''),
    NULLIF(regexp_replace(coalesce(NEW.phone, ''), '\D', '', 'g'), ''),
    NULLIF(regexp_replace(coalesce(NEW.mobile, ''), '\D', '', 'g'), ''),
    NULLIF(NEW.email, ''),
    NEW.name
  );

  INSERT INTO public.service_conversations(
    platform_id,
    contact_id,
    contact_name,
    contact_handle,
    contact_avatar_url,
    status,
    funnel_stage,
    last_message_preview,
    last_message_at,
    unread_count,
    auto_reply_enabled
  ) VALUES (
    NULL,
    NEW.id,
    NEW.name,
    v_handle,
    NEW.photo_url,
    'open',
    v_stage,
    NULL,
    now(),
    0,
    false
  )
  ON CONFLICT (contact_id) DO NOTHING;

  RETURN NEW;
END;
$function$;
