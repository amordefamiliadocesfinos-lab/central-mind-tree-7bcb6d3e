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
  }, []);

  const selectConversation = useCallback((id: string | null) => {
    setActiveConversationId(id);
    if (id) fetchMessages(id);
    else setMessages([]);
  }, [fetchMessages]);

  /**
   * Encaminhamento mínimo Digital → CRM: esta é a única escrita permitida
   * nesta visão. Ela apenas associa uma conversa já existente ao contato
   * canônico; envio e estado comercial passam a ocorrer exclusivamente na Inbox.
   */
  const linkConversationToCrmContact = useCallback(async (conversationId: string, contactId: string | null) => {
    const { error } = await supabase
      .from('service_conversations')
      .update({ contact_id: contactId })
      .eq('id', conversationId);
    if (error) { toast.error('Erro ao vincular contato'); return; }
    toast.success(contactId ? 'Contato vinculado' : 'Vínculo removido');
    fetchConversations();
  }, [fetchConversations]);


  /** Digital continua dono somente do contexto/origem de canais. */
  const updateDigitalChannelContext = useCallback(async (id: string, salesChannels: SalesChannelEntry[]) => {
    const { error } = await supabase
      .from('service_conversations')
      .update({ sales_channels: salesChannels as any })
      .eq('id', id);

    if (error) {
      toast.error('Erro ao atualizar conversa');
      return;
    }
    fetchConversations();
  }, [fetchConversations]);

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
    selectConversation,
    linkConversationToCrmContact,
    updateDigitalChannelContext,
    refetch: fetchConversations,
  };
}
