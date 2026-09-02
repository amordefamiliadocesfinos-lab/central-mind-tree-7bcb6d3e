import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { openWhatsApp } from '@/lib/whatsapp';
import { getTodayISO } from '@/lib/dateUtils';
import { CRM_EVENT_CODES, normalizeCrmStage } from '@/lib/crm/model';
import { setCrmNextAction } from '@/lib/crm/nextAction';
import { canScheduleAutomaticFollowUp } from '@/lib/crm/followUpTracking';

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
 * Executa o ciclo operacional de um contato iniciado pelo WhatsApp:
 * abre o canal, registra a interação, atualiza o funil e agenda o retorno.
 */
export function useWhatsAppWithLog() {
  const logAndOpen = useCallback(async (opts: WhatsAppLogOptions) => {
    const { contactId, contactName, phone, message, templateLabel, approach, source, skipOpen } = opts;

    if (!phone) {
      toast.error('Contato sem telefone/WhatsApp cadastrado');
      return false;
    }

    // Não altera o CRM se o navegador nem sequer conseguiu abrir o WhatsApp.
    if (!skipOpen) {
      const opened = openWhatsApp(phone, message);
      if (!opened) {
        toast.error('WhatsApp bloqueado pelo navegador. Libere pop-ups e tente novamente.');
        return false;
      }
    }

    const now = new Date().toISOString();
    const followUp = new Date();
    followUp.setDate(followUp.getDate() + 2);
    followUp.setHours(9, 0, 0, 0);
    const followUpAt = followUp.toISOString();
    const preview = message
      ? message.length > 120 ? `${message.slice(0, 120)}…` : message
      : '(sem mensagem prévia)';

    const { data: contact, error: contactError } = await supabase
      .from('contacts')
      .select('funnel_status')
      .eq('id', contactId)
      .maybeSingle();
    if (contactError || !contact) {
      toast.error('Não foi possível atualizar o atendimento no CRM');
      return false;
    }

    const previousStage = normalizeCrmStage(contact.funnel_status);
    const nextStage = ['novo_lead', 'cadencia'].includes(previousStage)
      ? 'contato_realizado'
      : previousStage;
    const historyDesc = templateLabel
      ? `📤 WhatsApp enviado · ${templateLabel} · "${preview}"`
      : approach
        ? `⚡ Atendimento inteligente · ${approach} · "${preview}"`
        : `📤 Mensagem iniciada via WhatsApp · "${preview}"`;

    const historyRows: {
      contact_id: string;
      event_type: string;
      interaction_type: string;
      event_code: string;
      event_metadata: Record<string, any>;
      description: string;
      interaction_date: string;
    }[] = [{
      contact_id: contactId,
      event_type: 'whatsapp',
      interaction_type: 'whatsapp',
      event_code: CRM_EVENT_CODES.MESSAGE_SENT,
      event_metadata: { source, template_label: templateLabel || null },
      description: historyDesc,
      interaction_date: now,
    }];
    if (nextStage !== previousStage) {
      historyRows.push({
        contact_id: contactId,
        event_type: 'stage_change',
        interaction_type: 'sistema',
        event_code: CRM_EVENT_CODES.STAGE_CHANGED,
        event_metadata: { source, old_stage: previousStage, new_stage: nextStage },
        description: `Movido automaticamente de "${previousStage}" para "${nextStage}" após contato por WhatsApp`,
        interaction_date: now,
      });
    }

    const { error: historyError } = await supabase.from('contact_history').insert(historyRows);
    if (historyError) console.error('Erro ao registrar no histórico:', historyError);

    const { error: contactUpdateError } = await supabase
      .from('contacts')
      .update({
        ultimo_contato: getTodayISO(),
        funnel_status: nextStage,
        updated_at: now,
      })
      .eq('id', contactId);
    if (contactUpdateError) {
      toast.error('Mensagem aberta, mas o CRM não conseguiu atualizar o contato');
      return false;
    }

    const { data: existingConv } = await supabase
      .from('service_conversations')
      .select('id')
      .eq('contact_id', contactId)
      .order('last_message_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    // F5.2.2 — depois da 3ª tentativa do ciclo o CRM não cria automaticamente
    // uma nova obrigação de follow-up apenas por ausência de resposta.
    const canScheduleFollowUp = await canScheduleAutomaticFollowUp(contactId);

    const conversationState = {
      last_message_preview: preview,
      last_message_at: now,
      last_outbound_at: now,
      funnel_stage: nextStage,
      attendance_state: 'aguardando_cliente',
      needs_reply: false,
      ...(canScheduleFollowUp ? { return_at: followUpAt } : {}),
      updated_at: now,
    };

    let conversationId = existingConv?.id || null;
    if (conversationId) {
      await supabase.from('service_conversations').update(conversationState).eq('id', conversationId);
    } else {
      const { data: newConv } = await supabase
        .from('service_conversations')
        .insert({
          contact_id: contactId,
          contact_name: contactName,
          contact_handle: phone,
          status: 'open',
          ...conversationState,
        })
        .select('id')
        .single();
      conversationId = newConv?.id || null;
    }

    if (conversationId && canScheduleFollowUp) {
      try {
        await setCrmNextAction({
          contactId,
          title: 'Verificar resposta do cliente',
          dueAt: followUpAt,
          conversationId,
          syncConversationReturn: true,
        });
      } catch (error) {
        console.error('Contato atualizado, mas a tarefa de follow-up falhou:', error);
        toast.warning('Contato atualizado, mas revise a tarefa de follow-up');
      }
    }

    if (conversationId) {
      await supabase.from('service_messages').insert({
        conversation_id: conversationId,
        sender: 'agent',
        content: message || 'Mensagem iniciada via WhatsApp',
        message_type: 'text',
        direction: 'outbound',
        delivery_status: 'sent',
        source: 'crm',
        created_at: now,
      });
    }

    toast.success(canScheduleFollowUp
      ? 'Atendimento registrado · follow-up em 2 dias'
      : 'Mensagem registrada · limite de follow-up atingido neste ciclo: decida o próximo passo');
    return { nextStage, followUpAt } satisfies WhatsAppOperationalResult;
  }, []);

  return { logAndOpen };
}
