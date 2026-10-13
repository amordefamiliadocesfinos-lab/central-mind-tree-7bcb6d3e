-- CRM F0-D: reconciliação formal auditável de envios API incertos.
-- Migração AUTÔNOMA do CRM: não envia mensagens e não reabre destinatários.
-- Não executar manualmente em produção sem a governança de migrations.
CREATE TABLE IF NOT EXISTS public.crm_campaign_recipient_reconciliations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.crm_campaigns(id),
  recipient_id uuid NOT NULL UNIQUE REFERENCES public.crm_campaign_recipients(id),
  service_message_id uuid NOT NULL REFERENCES public.service_messages(id),
  provider_message_id text NOT NULL CHECK (length(btrim(provider_message_id)) > 0),
  evidence_delivery_status text NOT NULL
    CHECK (evidence_delivery_status IN ('sent', 'delivered', 'read')),
  before_status text NOT NULL CHECK (before_status = 'failed'),
  after_status text NOT NULL CHECK (after_status = 'sent'),
  actor_auth_user_id uuid NOT NULL,
  actor_app_user_id uuid NOT NULL REFERENCES public.app_users(id),
  evidence_snapshot jsonb NOT NULL,
  reconciled_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_crm_campaign_recipient_reconciliations_campaign
  ON public.crm_campaign_recipient_reconciliations(campaign_id, reconciled_at DESC);

ALTER TABLE public.crm_campaign_recipient_reconciliations ENABLE ROW LEVEL SECURITY;

-- Nenhuma escrita direta na tabela de auditoria via cliente autenticado.
REVOKE ALL ON public.crm_campaign_recipient_reconciliations FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.crm_campaign_recipient_reconciliations TO authenticated;

DROP POLICY IF EXISTS crm_campaign_reconciliation_admin_read
  ON public.crm_campaign_recipient_reconciliations;
CREATE POLICY crm_campaign_reconciliation_admin_read
  ON public.crm_campaign_recipient_reconciliations FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.app_users u
      WHERE u.auth_user_id = auth.uid()
        AND u.is_active = true
        AND u.role = 'Administrador'
    )
  );

-- O log não pode ser editado/apagado por ações operacionais.
CREATE OR REPLACE FUNCTION public.reject_crm_campaign_reconciliation_mutation()
RETURNS trigger LANGUAGE plpgsql
SET search_path = public, pg_temp AS $$
BEGIN
  RAISE EXCEPTION 'O histórico de conciliação CRM é imutável.';
END;
$$;
DROP TRIGGER IF EXISTS trg_crm_campaign_reconciliation_immutable
  ON public.crm_campaign_recipient_reconciliations;
CREATE TRIGGER trg_crm_campaign_reconciliation_immutable
  BEFORE UPDATE OR DELETE ON public.crm_campaign_recipient_reconciliations
  FOR EACH ROW EXECUTE FUNCTION public.reject_crm_campaign_reconciliation_mutation();

-- A confirmação é atômica e o servidor revalida TODOS os fatos, não confia
-- na evidência exibida no navegador nem no status em cache da campanha.
CREATE OR REPLACE FUNCTION public.reconcile_crm_campaign_recipient(
  p_recipient_id uuid,
  p_service_message_id uuid
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp AS $$
DECLARE
  v_actor uuid;
  v_rec public.crm_campaign_recipients%ROWTYPE;
  v_msg public.service_messages%ROWTYPE;
  v_prior public.crm_campaign_recipient_reconciliations%ROWTYPE;
  v_audit_id uuid;
  v_sent_at timestamptz;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Autenticação obrigatória para conciliação.' USING ERRCODE = '42501';
  END IF;

  SELECT u.id INTO v_actor
  FROM public.app_users u
  WHERE u.auth_user_id = auth.uid()
    AND u.is_active = true
    AND u.role = 'Administrador'
  LIMIT 1;
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'Somente administrador ativo pode confirmar esta conciliação.'
      USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_rec
  FROM public.crm_campaign_recipients
  WHERE id = p_recipient_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Destinatário da campanha não encontrado.';
  END IF;

  -- Retentativa idempotente apenas se já existe log da MESMA evidência.
  IF v_rec.status = 'sent' THEN
    SELECT * INTO v_prior
    FROM public.crm_campaign_recipient_reconciliations
    WHERE recipient_id = p_recipient_id;
    IF v_prior.id IS NOT NULL
      AND v_prior.service_message_id = p_service_message_id THEN
      RETURN jsonb_build_object(
        'status', 'already_reconciled',
        'audit_id', v_prior.id,
        'recipient_id', p_recipient_id
      );
    END IF;
    RAISE EXCEPTION 'Destinatário já enviado sem conciliação equivalente.';
  END IF;

  IF v_rec.status <> 'failed'
    OR v_rec.delivery_mode IS DISTINCT FROM 'api'
    OR v_rec.service_message_id IS DISTINCT FROM p_service_message_id
    OR v_rec.conversation_id IS NULL THEN
    RAISE EXCEPTION 'Destinatário não elegível ou sem referência exata de mensagem.';
  END IF;

  SELECT * INTO v_msg
  FROM public.service_messages
  WHERE id = p_service_message_id;
  IF NOT FOUND
    OR v_msg.conversation_id IS DISTINCT FROM v_rec.conversation_id
    OR v_msg.direction IS DISTINCT FROM 'outbound'
    OR v_msg.source IS DISTINCT FROM 'crm'
    OR v_msg.sender IS DISTINCT FROM 'agent'
    OR btrim(coalesce(v_msg.content, '')) IS DISTINCT FROM btrim(coalesce(v_rec.rendered_message, ''))
    OR btrim(coalesce(v_msg.content, '')) = ''
    OR coalesce(v_msg.delivery_status, '') NOT IN ('sent', 'delivered', 'read')
    OR nullif(btrim(coalesce(v_msg.external_message_id, '')), '') IS NULL
    OR (v_rec.external_message_id IS NOT NULL
        AND v_rec.external_message_id IS DISTINCT FROM v_msg.external_message_id) THEN
    RAISE EXCEPTION 'Não há evidência verificável de envio para a mensagem exata.';
  END IF;

  v_sent_at := coalesce(v_msg.provider_timestamp, v_msg.created_at, now());
  UPDATE public.crm_campaign_recipients
  SET status = 'sent',
      sent_at = v_sent_at,
      external_message_id = v_msg.external_message_id,
      error_code = NULL,
      error_message = NULL
  WHERE id = v_rec.id AND status = 'failed';

  INSERT INTO public.crm_campaign_recipient_reconciliations (
    campaign_id, recipient_id, service_message_id, provider_message_id,
    evidence_delivery_status, before_status, after_status,
    actor_auth_user_id, actor_app_user_id, evidence_snapshot
  ) VALUES (
    v_rec.campaign_id, v_rec.id, v_msg.id, v_msg.external_message_id,
    v_msg.delivery_status, 'failed', 'sent', auth.uid(), v_actor,
    jsonb_build_object(
      'source', v_msg.source,
      'direction', v_msg.direction,
      'provider', v_msg.provider_name,
      'delivery_status', v_msg.delivery_status,
      'provider_timestamp', v_msg.provider_timestamp,
      'service_message_created_at', v_msg.created_at,
      'prior_error_code', v_rec.error_code,
      'prior_error_message', v_rec.error_message
    )
  ) RETURNING id INTO v_audit_id;

  -- Counters refletem recipients efetivos; a campanha não é reenviada.
  UPDATE public.crm_campaigns
  SET total_sent = (
        SELECT count(*) FROM public.crm_campaign_recipients
        WHERE campaign_id = v_rec.campaign_id AND status = 'sent'
      ),
      total_failed = (
        SELECT count(*) FROM public.crm_campaign_recipients
        WHERE campaign_id = v_rec.campaign_id AND status = 'failed'
      ),
      updated_at = now()
  WHERE id = v_rec.campaign_id;

  RETURN jsonb_build_object(
    'status', 'reconciled',
    'audit_id', v_audit_id,
    'recipient_id', v_rec.id,
    'service_message_id', v_msg.id,
    'external_message_id', v_msg.external_message_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.reconcile_crm_campaign_recipient(uuid, uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reconcile_crm_campaign_recipient(uuid, uuid)
  TO authenticated;
