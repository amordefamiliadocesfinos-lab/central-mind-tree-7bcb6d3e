-- F6-B.2a — contenção dos writers concorrentes de automation_rules.
-- Mantém o trigger como detector/sinalizador, mas remove autoridade para
-- Próxima Ação, crm_next_action e transição de funil.

CREATE OR REPLACE FUNCTION public.apply_funnel_automations()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  r RECORD;
  v_msg text;
  v_effect text;
BEGIN
  IF NEW.funnel_status IS NULL OR NEW.funnel_status IS NOT DISTINCT FROM OLD.funnel_status THEN
    RETURN NEW;
  END IF;

  FOR r IN
    SELECT *
      FROM public.automation_rules
     WHERE is_active = true
       AND trigger_type = 'funnel_stage_changed'
       AND trigger_config->>'stage' = NEW.funnel_status
  LOOP
    BEGIN
      IF r.action_type IN ('alert', 'notify') THEN
        -- Ações estritamente não-operacionais: somente sinal no histórico.
        v_msg := COALESCE(r.action_config->>'message', r.name, 'Automação detectada');
        INSERT INTO public.contact_history (
          contact_id, event_type, interaction_type, description, interaction_date
        )
        VALUES (
          NEW.id, 'automation', 'observacao', '⚙️ ' || v_msg, now()
        );
        v_effect := 'signal_recorded';

      ELSIF r.action_type IN ('create_task', 'change_funnel_stage') THEN
        -- F6-B.2a: regras legadas podem ser detectadas, mas não materializam
        -- Próxima Ação, crm_next_action nem alteração de funnel_status.
        INSERT INTO public.contact_history (
          contact_id, event_type, interaction_type, description, interaction_date
        )
        VALUES (
          NEW.id,
          'automation',
          'observacao',
          '⚙️ Automação detectada sem efeito operacional — ' || r.name,
          now()
        );
        v_effect := 'operational_write_blocked';

      ELSE
        -- Tipos desconhecidos permanecem observáveis, sem qualquer escrita CRM.
        v_effect := 'unsupported_action_ignored';
      END IF;

      INSERT INTO public.automation_logs (
        rule_id, triggered_at, status, trigger_data, action_result
      )
      VALUES (
        r.id,
        now(),
        'success',
        jsonb_build_object(
          'contact_id', NEW.id,
          'old_stage', OLD.funnel_status,
          'new_stage', NEW.funnel_status
        ),
        jsonb_build_object(
          'action_type', r.action_type,
          'effect', v_effect,
          'target_type', 'contact',
          'target_id', NEW.id
        )
      );

      UPDATE public.automation_rules
         SET last_triggered_at = now()
       WHERE id = r.id;

    EXCEPTION WHEN OTHERS THEN
      INSERT INTO public.automation_logs (
        rule_id, triggered_at, status, trigger_data, action_result
      )
      VALUES (
        r.id,
        now(),
        'error',
        jsonb_build_object(
          'contact_id', NEW.id,
          'old_stage', OLD.funnel_status,
          'new_stage', NEW.funnel_status
        ),
        jsonb_build_object(
          'action_type', r.action_type,
          'effect', 'signal_processing_error',
          'error', SQLERRM
        )
      );
    END;
  END LOOP;

  RETURN NEW;
END;
$function$;

-- Aposenta cirurgicamente as duas regras operacionais identificadas em F6-B.1.
-- Preserva registro, configuração e automation_logs; usa IDs estáveis, não nomes.
UPDATE public.automation_rules
   SET is_active = false,
       updated_at = now()
 WHERE id IN (
   'e3d3808a-e980-486a-8d0a-72eb5e8a3b74'::uuid, -- rafaela teste
   '23de88ba-6aa4-41ab-8a87-eba61d3548f5'::uuid  -- Fechados > Pós venda
 );
