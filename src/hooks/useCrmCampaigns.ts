/**
 * FRENTE 3.2 — Campanhas CRM: criação, segmentação e elegibilidade.
 * Esta camada NÃO envia mensagens e não toca Inbox, Prioridade, Tarefas ou Reativação.
 */
import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  EligibilityContact,
  EvaluatedRecipient,
  evaluateRecipients,
  summarize,
} from '@/lib/crm/campaignEligibility';

const db = supabase as any;

export type CampaignStatus = 'draft' | 'prepared' | 'sending' | 'completed' | 'cancelled';

export interface CrmCampaign {
  id: string;
  name: string;
  message_text: string;
  media_url: string | null;
  media_type: string | null;
  status: CampaignStatus;
  segment_filters: Record<string, unknown> | null;
  total_selected: number;
  total_eligible: number;
  total_excluded: number;
  total_sent: number;
  total_failed: number;
  created_at: string;
}

export interface CrmCampaignRecipient {
  id: string;
  campaign_id: string;
  contact_id: string;
  conversation_id: string | null;
  phone_normalized: string | null;
  rendered_message: string | null;
  status: string;
  exclusion_reason: string | null;
  delivery_mode: string | null;
}

/** Substitui placeholders simples da mensagem por dados do contato. */
export function renderMessage(template: string, contactName: string): string {
  const first = contactName.split(' ')[0] || contactName;
  return template
    .replace(/\{\{\s*nome\s*\}\}/gi, contactName)
    .replace(/\{\{\s*primeiro_nome\s*\}\}/gi, first);
}

/**
 * FRENTE 3.3 — Modo de execução.
 * api: existe conversa no CRM e a janela de 24h está aberta (envio pela integração é válido).
 * manual: qualquer outro caso elegível — continua na campanha, executado por fila guiada.
 */
export function resolveDeliveryMode(
  conversation: { id?: string | null; last_inbound_at?: string | null } | null | undefined,
): 'api' | 'manual' {
  if (!conversation?.id) return 'manual';
  const inboundAt = conversation.last_inbound_at ? Date.parse(conversation.last_inbound_at) : 0;
  if (!inboundAt) return 'manual';
  return Date.now() - inboundAt <= 24 * 60 * 60 * 1000 ? 'api' : 'manual';
}



export function useCrmCampaigns() {
  const [campaigns, setCampaigns] = useState<CrmCampaign[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchCampaigns = useCallback(async () => {
    setLoading(true);
    const { data, error } = await db
      .from('crm_campaigns')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) toast.error(error.message);
    setCampaigns((data || []) as CrmCampaign[]);
    setLoading(false);
  }, []);

  useEffect(() => { fetchCampaigns(); }, [fetchCampaigns]);

  const createCampaignFromSegment = useCallback(
    async (input: {
      name: string;
      message_text: string;
      media_url?: string | null;
      media_type?: string | null;
      segment_filters: Record<string, unknown>;
      contacts: EligibilityContact[];
    }): Promise<string | null> => {
      const evaluated: EvaluatedRecipient[] = evaluateRecipients(input.contacts);
      const totals = summarize(evaluated);

      const { data: campaign, error } = await db
        .from('crm_campaigns')
        .insert({
          name: input.name,
          message_text: input.message_text,
          media_url: input.media_url || null,
          media_type: input.media_type || null,
          status: 'draft',
          segment_filters: input.segment_filters,
          ...totals,
        })
        .select()
        .single();
      if (error || !campaign) { toast.error(error?.message || 'Falha ao criar campanha'); return null; }

      // conversation_id + janela de 24h (somente leitura) para definir delivery_mode.
      const contactIds = evaluated.map(r => r.contact_id);
      const conversationByContact = new Map<string, { id: string; last_inbound_at: string | null }>();
      for (let i = 0; i < contactIds.length; i += 200) {
        const slice = contactIds.slice(i, i + 200);
        const { data: convs } = await db
          .from('service_conversations')
          .select('id, contact_id, last_inbound_at, last_message_at')
          .in('contact_id', slice)
          .order('last_message_at', { ascending: false });
        (convs || []).forEach((c: any) => {
          if (c.contact_id && !conversationByContact.has(c.contact_id)) conversationByContact.set(c.contact_id, c);
        });
      }

      const rows = evaluated.map(r => {
        const conv = conversationByContact.get(r.contact_id) || null;
        return {
          campaign_id: campaign.id,
          contact_id: r.contact_id,
          conversation_id: conv?.id || null,
          phone_normalized: r.phone_normalized,
          rendered_message: r.status === 'pending' ? renderMessage(input.message_text, r.contact_name) : null,
          status: r.status,
          exclusion_reason: r.exclusion_reason,
          delivery_mode: r.status === 'pending' ? resolveDeliveryMode(conv) : null,
        };
      });


      for (let i = 0; i < rows.length; i += 200) {
        const { error: recErr } = await db
          .from('crm_campaign_recipients')
          .upsert(rows.slice(i, i + 200), { onConflict: 'campaign_id,contact_id' });
        if (recErr) { toast.error(recErr.message); break; }
      }

      toast.success(`Campanha criada: ${totals.total_eligible} elegíveis de ${totals.total_selected}`);
      await fetchCampaigns();
      return campaign.id as string;
    },
    [fetchCampaigns],
  );

  const markPrepared = useCallback(async (campaignId: string) => {
    const { error } = await db
      .from('crm_campaigns')
      .update({ status: 'prepared', updated_at: new Date().toISOString() })
      .eq('id', campaignId);
    if (error) { toast.error(error.message); return false; }
    toast.success('Campanha marcada como preparada (nenhum envio realizado)');
    await fetchCampaigns();
    return true;
  }, [fetchCampaigns]);

  return { campaigns, loading, fetchCampaigns, createCampaignFromSegment, markPrepared };
}

export async function fetchCampaignRecipients(campaignId: string) {
  const { data, error } = await db
    .from('crm_campaign_recipients')
    .select('*, contact:contacts(id, name)')
    .eq('campaign_id', campaignId)
    .order('status', { ascending: true });
  if (error) { toast.error(error.message); return []; }
  return (data || []) as (CrmCampaignRecipient & { contact?: { name?: string } })[];
}
