import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { openWhatsApp } from '@/lib/whatsapp';
import { CRM_EVENT_CODES } from '@/lib/crm/model';

export interface WhatsAppLogOptions {
  contactId: string;
  contactName: string;
  phone: string;
  message?: string;
  templateLabel?: string;
  approach?: string;
  source: 'crm_card' | 'crm_smart_attend' | 'crm_follow_up' | 'atendimento' | 'dashboard';
  /** O chamador já abriu o WhatsApp, por exemplo ao compartilhar anexos. */
  skipOpen?: boolean;
}

export interface WhatsAppOperationalResult {
  nextStage: string;
  followUpAt: string;
}

/**
 * Abre o WhatsApp e registra apenas a tentativa de contato.
 *
 * Abrir o WhatsApp/Web não confirma que a mensagem foi efetivamente enviada.
 * Por isso este fluxo NÃO pode materializar estado operacional do CRM
 * (último contato, etapa, próxima ação, return_at ou mensagem outbound sent).
 *
 * Envios realmente confirmados devem passar pelo sender/API oficial,
 * que recebe confirmação positiva do provedor antes de registrar `sent`.
 */
export function useWhatsAppWithLog() {
  const logAndOpen = useCallback(async (opts: WhatsAppLogOptions) => {
    const { contactId, phone, message, templateLabel, approach, source, skipOpen } = opts;

    if (!phone) {
      toast.error('Contato sem telefone/WhatsApp cadastrado');
      return false;
    }

    if (!skipOpen) {
      const opened = openWhatsApp(phone, message);
      if (!opened) {
        toast.error('WhatsApp bloqueado pelo navegador. Libere pop-ups e tente novamente.');
        return false;
      }
    }

    const now = new Date().toISOString();
    const preview = message
      ? message.length > 120 ? `${message.slice(0, 120)}…` : message
      : '(sem mensagem prévia)';

    const description = templateLabel
      ? `📲 WhatsApp aberto · ${templateLabel} · envio não confirmado · "${preview}"`
      : approach
        ? `📲 WhatsApp aberto · ${approach} · envio não confirmado · "${preview}"`
        : `📲 WhatsApp aberto · envio não confirmado · "${preview}"`;

    const { error: historyError } = await supabase.from('contact_history').insert({
      contact_id: contactId,
      event_type: 'whatsapp',
      interaction_type: 'whatsapp',
      event_code: CRM_EVENT_CODES.CONTACT_ATTEMPTED,
      event_metadata: {
        source,
        template_label: templateLabel || null,
        send_confirmation: 'unconfirmed',
        channel_opened: true,
      },
      description,
      interaction_date: now,
    });

    if (historyError) {
      console.error('Erro ao registrar tentativa de contato no histórico:', historyError);
      toast.warning('WhatsApp aberto, mas a tentativa não pôde ser registrada no CRM');
      return false;
    }

    toast.info('WhatsApp aberto · envio ainda não confirmado pelo CRM');

    // Retorno `false` é intencional: callers antigos só aplicam efeitos
    // otimistas de "mensagem enviada" quando recebem um resultado operacional.
    // Este fluxo não possui confirmação real de envio.
    return false;
  }, []);

  return { logAndOpen };
}
