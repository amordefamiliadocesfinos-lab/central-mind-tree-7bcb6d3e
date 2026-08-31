import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { normalizeCrmStage, type CrmFunnelStage } from '@/lib/crm/model';

export interface SalesChannelEntry {
  platform_id: string;
  added_at: string;
}

export interface ServiceConversation {
  id: string;
  platform_id: string | null;
  contact_id: string | null;
  contact_name: string | null;
  contact_handle: string | null;
  contact_avatar_url: string | null;
  status: 'open' | 'closed' | 'archived';
  funnel_stage: CrmFunnelStage;
  last_message_at: string;
  last_message_preview: string | null;
  unread_count: number;
  auto_reply_enabled: boolean;
  sales_channels: SalesChannelEntry[];
  created_at: string;
  updated_at: string;
}

export interface ServiceMessage {
  id: string;
  conversation_id: string;
  sender: 'customer' | 'agent' | 'ai_suggestion';
  content: string;
  is_ai_suggested: boolean;
  ai_approved: boolean | null;
  intent_detected: string | null;
  created_at: string;
}

export function useServiceChat() {
  const [conversations, setConversations] = useState<ServiceConversation[]>([]);
  const [messages, setMessages] = useState<ServiceMessage[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [aiSuggesting, setAiSuggesting] = useState(false);

  const fetchConversations = useCallback(async () => {
    const { data, error } = await supabase
      .from('service_conversations')
      .select('*')
      .order('last_message_at', { ascending: false });

    if (error) {
      console.error('Error fetching conversations:', error);
      setLoading(false);
      return;
    }
    setConversations((data || []).map(conversation => ({
      ...conversation,
      funnel_stage: normalizeCrmStage(conversation.funnel_stage),
    })) as unknown as ServiceConversation[]);
    setLoading(false);
  }, []);

  const fetchMessages = useCallback(async (conversationId: string) => {
    setMessagesLoading(true);
    // Busca as mais recentes (desc + limite) e reordena: conversas longas
    // ultrapassam o teto de linhas da API e escondiam os últimos envios.
    const { data, error } = await supabase
      .from('service_messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: false })
      .limit(200);

    if (error) {
      console.error('Error fetching messages:', error);
      setMessagesLoading(false);
      return;
    }
    setMessages(((data || []).slice().reverse()) as unknown as ServiceMessage[]);

    setMessagesLoading(false);

    // Mark as read
    await supabase
      .from('service_conversations')
      .update({ unread_count: 0 })
      .eq('id', conversationId);
  }, []);

  const selectConversation = useCallback((id: string | null) => {
    setActiveConversationId(id);
    if (id) fetchMessages(id);
    else setMessages([]);
  }, [fetchMessages]);

  const createConversation = useCallback(async (data: {
    platform_id?: string;
    contact_id?: string | null;
    contact_name?: string;
    contact_handle?: string;
  }) => {
    const { data: conv, error } = await supabase
      .from('service_conversations')
      .insert({
        platform_id: data.platform_id || null,
        contact_id: data.contact_id || null,
        contact_name: data.contact_name || null,
        contact_handle: data.contact_handle || null,
        status: 'open',
        funnel_stage: 'novo_lead',
      })
      .select()
      .single();

    if (error) {
      toast.error('Erro ao criar conversa');
      return null;
    }
    toast.success('Conversa criada!');
    fetchConversations();
    return conv as unknown as ServiceConversation;
  }, [fetchConversations]);

  const linkContactToConversation = useCallback(async (conversationId: string, contactId: string | null) => {
    const { error } = await supabase
      .from('service_conversations')
      .update({ contact_id: contactId })
      .eq('id', conversationId);
    if (error) { toast.error('Erro ao vincular contato'); return; }
    toast.success(contactId ? 'Contato vinculado' : 'Vínculo removido');
    fetchConversations();
  }, [fetchConversations]);


  const sendMessage = useCallback(async (conversationId: string, content: string, sender: 'customer' | 'agent' = 'agent') => {
    const { data: msg, error } = await supabase
      .from('service_messages')
      .insert({
        conversation_id: conversationId,
        content,
        sender,
        is_ai_suggested: false,
      })
      .select()
      .single();

    if (error) {
      toast.error('Erro ao enviar mensagem');
      return null;
    }

    // Update conversation preview
    await supabase
      .from('service_conversations')
      .update({
        last_message_at: new Date().toISOString(),
        last_message_preview: content.slice(0, 100),
        unread_count: sender === 'customer' ? 1 : 0,
      })
      .eq('id', conversationId);

    // Log for AI learning (invisible)
    const conv = conversations.find(c => c.id === conversationId);
    if (sender === 'agent') {
      await supabase.from('service_ai_logs').insert({
        conversation_id: conversationId,
        message_id: (msg as any).id,
        platform_id: conv?.platform_id || null,
        interaction_type: 'agent_response',
        approved_response: content,
      });
    }

    fetchMessages(conversationId);
    fetchConversations();
    return msg as unknown as ServiceMessage;
  }, [fetchMessages, fetchConversations, conversations]);

  const suggestAIResponse = useCallback(async (conversationId: string) => {
    setAiSuggesting(true);
    const conv = conversations.find(c => c.id === conversationId);
    const recentMessages = messages.slice(-10);

    // Etapa 5: contexto do CRM (se a conversa estiver vinculada a um contato)
    let contactContext = '';
    if (conv?.contact_id) {
      const [{ data: contact }, { data: recentHistory }, { data: orders }] = await Promise.all([
        supabase.from('contacts')
          .select('name,fantasy_name,funnel_status,client_classification,temperatura_lead,lifetime_value,paid_orders_count,last_purchase_date,city,origem_lead,notes,next_action_text,next_action_date')
          .eq('id', conv.contact_id).maybeSingle(),
        supabase.from('contact_history')
          .select('interaction_type,event_type,description,interaction_date,created_at')
          .eq('contact_id', conv.contact_id)
          .order('interaction_date', { ascending: false })
          .limit(8),
        supabase.from('orders')
          .select('order_number,status,total_value,order_date')
          .eq('contact_id', conv.contact_id)
          .order('order_date', { ascending: false })
          .limit(5),
      ]);
      if (contact) {
        const lines: string[] = [
          `Nome: ${contact.name}${contact.fantasy_name ? ` (${contact.fantasy_name})` : ''}`,
          `Funil: ${contact.funnel_status} | Classificação: ${contact.client_classification ?? '—'} | Temperatura: ${contact.temperatura_lead ?? '—'}`,
          `LTV: R$ ${Number(contact.lifetime_value || 0).toFixed(2)} | Pedidos pagos: ${contact.paid_orders_count ?? 0} | Última compra: ${contact.last_purchase_date ?? '—'}`,
          `Cidade: ${contact.city ?? '—'} | Origem: ${contact.origem_lead ?? '—'}`,
          `Próxima ação planejada: ${contact.next_action_text ?? '—'} (${contact.next_action_date ?? '—'})`,
          contact.notes ? `Notas internas: ${contact.notes}` : '',
        ].filter(Boolean);
        if (orders?.length) {
          lines.push(`Últimos pedidos: ${orders.map(o => `#${o.order_number}/${o.status}/R$${o.total_value ?? 0}`).join(' • ')}`);
        }
        if (recentHistory?.length) {
          lines.push('Histórico recente:');
          for (const h of recentHistory) {
            const d = (h.interaction_date ?? h.created_at)?.slice(0, 10);
            lines.push(`  - [${d}] ${h.interaction_type ?? h.event_type}: ${h.description?.slice(0, 140)}`);
          }
        }
        contactContext = lines.join('\n');
      }
    }

    try {
      const { data, error } = await supabase.functions.invoke('digital-trends', {
        body: {
          type: 'service_response',
          query: {
            conversation_history: recentMessages.map(m => ({
              role: m.sender === 'customer' ? 'customer' : 'agent',
              content: m.content,
            })),
            platform: conv?.platform_id || 'general',
            funnel_stage: conv?.funnel_stage || 'novo_lead',
            contact_name: conv?.contact_name || 'Cliente',
            contact_context: contactContext || undefined,
          },
        },
      });

      if (error) throw error;

      if (data?.success && data?.data?.response) {
        const suggestion = data.data.response;

        // Save as AI suggestion message
        const { data: aiMsg } = await supabase
          .from('service_messages')
          .insert({
            conversation_id: conversationId,
            content: suggestion,
            sender: 'ai_suggestion',
            is_ai_suggested: true,
          })
          .select()
          .single();

        // Log AI suggestion
        await supabase.from('service_ai_logs').insert({
          conversation_id: conversationId,
          message_id: aiMsg ? (aiMsg as any).id : null,
          platform_id: conv?.platform_id || null,
          interaction_type: 'ai_suggestion',
          ai_suggested_response: suggestion,
          intent_detected: data.data.intent || null,
        });

        fetchMessages(conversationId);
        toast.success('Sugestão gerada!');
      }
    } catch (err) {
      console.error('AI suggestion error:', err);
      toast.error('Erro ao gerar sugestão');
    } finally {
      setAiSuggesting(false);
    }
  }, [conversations, messages, fetchMessages]);

  const approveAISuggestion = useCallback(async (messageId: string, approved: boolean) => {
    const msg = messages.find(m => m.id === messageId);
    if (!msg) return;

    if (approved) {
      // Update the AI message as approved
      await supabase.from('service_messages').update({ ai_approved: true }).eq('id', messageId);

      // Send as agent message
      await sendMessage(msg.conversation_id, msg.content, 'agent');

      // Log approval
      await supabase.from('service_ai_logs').insert({
        conversation_id: msg.conversation_id,
        message_id: messageId,
        interaction_type: 'ai_approved',
        ai_suggested_response: msg.content,
        approved_response: msg.content,
      });
    } else {
      // Mark as rejected
      await supabase.from('service_messages').update({ ai_approved: false }).eq('id', messageId);
      await supabase.from('service_ai_logs').insert({
        conversation_id: msg.conversation_id,
        message_id: messageId,
        interaction_type: 'ai_rejected',
        ai_suggested_response: msg.content,
      });
    }

    fetchMessages(msg.conversation_id);
  }, [messages, sendMessage, fetchMessages]);

  const updateConversation = useCallback(async (id: string, updates: Partial<ServiceConversation>) => {
    const updatePayload: Record<string, any> = { ...updates };
    if (updates.funnel_stage) {
      updatePayload.funnel_stage = normalizeCrmStage(updates.funnel_stage);
    }
    if (updates.sales_channels) {
      updatePayload.sales_channels = updates.sales_channels as any;
    }
    const { error } = await supabase
      .from('service_conversations')
      .update(updatePayload)
      .eq('id', id);

    if (error) {
      toast.error('Erro ao atualizar conversa');
      return;
    }
    fetchConversations();
  }, [fetchConversations]);

  const deleteConversation = useCallback(async (id: string) => {
    const { error } = await supabase
      .from('service_conversations')
      .delete()
      .eq('id', id);

    if (error) {
      toast.error('Erro ao excluir conversa');
      return;
    }
    if (activeConversationId === id) {
      setActiveConversationId(null);
      setMessages([]);
    }
    toast.success('Conversa excluída');
    fetchConversations();
  }, [activeConversationId, fetchConversations]);

  const toggleAutoReply = useCallback(async (conversationId: string, enabled: boolean) => {
    await updateConversation(conversationId, { auto_reply_enabled: enabled } as any);
    toast.success(enabled ? '⚠️ Modo automático ativado para esta conversa' : 'Modo automático desativado');
  }, [updateConversation]);

  useEffect(() => {
    fetchConversations();

    const channel = supabase
      .channel('service-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'service_conversations' }, fetchConversations)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'service_messages' }, (payload) => {
        if (activeConversationId && (payload.new as any)?.conversation_id === activeConversationId) {
          fetchMessages(activeConversationId);
        }
        fetchConversations();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [fetchConversations, fetchMessages, activeConversationId]);

  return {
    conversations,
    messages,
    activeConversationId,
    loading,
    messagesLoading,
    aiSuggesting,
    selectConversation,
    createConversation,
    sendMessage,
    suggestAIResponse,
    approveAISuggestion,
    updateConversation,
    deleteConversation,
    linkContactToConversation,
    toggleAutoReply,
    refetch: fetchConversations,
  };
}
