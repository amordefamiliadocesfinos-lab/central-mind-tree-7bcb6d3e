/**
 * FRENTE 3.2 — Campanhas CRM: criação, segmentação e elegibilidade.
 * Esta camada NÃO envia mensagens e não toca Inbox, Prioridade, Tarefas ou Reativação.
 */
import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { CAMPAIGN_UNCONFIRMED_CODE, canSafelyRequeueCampaignRecipient } from '@/lib/crm/campaignReplaySafety';
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
  sent_at?: string | null;
  error_code?: string | null;
  error_message?: string | null;
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

/** Recalcula os contadores de envio da campanha a partir dos recipients reais. */
export async function refreshCampaignCounters(campaignId: string) {
  const { data } = await db
    .from('crm_campaign_recipients')
    .select('status')
    .eq('campaign_id', campaignId);
  const rows = (data || []) as { status: string }[];
  const total_sent = rows.filter(r => r.status === 'sent').length;
  const total_failed = rows.filter(r => r.status === 'failed').length;
  await db.from('crm_campaigns').update({ total_sent, total_failed, updated_at: new Date().toISOString() }).eq('id', campaignId);
  return { total_sent, total_failed };
}

/**
 * FRENTE 3.6 — Coerência de status.
 * sending  → ainda existem recipients executáveis (pending api/manual) ou já houve execução.
 * completed → nenhum recipient executável pendente e já houve envio/falha.
 * draft/prepared/cancelled não são alterados automaticamente.
 */
export async function syncCampaignStatus(campaign: { id: string; status: string }) {
  if (campaign.status === 'draft' || campaign.status === 'prepared' || campaign.status === 'cancelled') return campaign.status;

  const { count: pending } = await db
    .from('crm_campaign_recipients')
    .select('id', { count: 'exact', head: true })
    .eq('campaign_id', campaign.id)
    .eq('status', 'pending');

  const next = pending && pending > 0 ? 'sending' : 'completed';
  if (next !== campaign.status) {
    await db.from('crm_campaigns').update({ status: next, updated_at: new Date().toISOString() }).eq('id', campaign.id);
  }
  return next;
}


/**
 * Revalida commercial_opt_out antes de qualquer execução manual.
 * Se passou a true depois da preparação, o recipient é bloqueado (excluded) — sem override.
 */
export async function revalidateOptOut(contactIds: string[]): Promise<Set<string>> {
  const blocked = new Set<string>();
  for (let i = 0; i < contactIds.length; i += 200) {
    const { data } = await db
      .from('contacts')
      .select('id, commercial_opt_out')
      .in('id', contactIds.slice(i, i + 200));
    (data || []).forEach((c: any) => { if (c.commercial_opt_out === true) blocked.add(c.id); });
  }
  return blocked;
}

/** Marca um recipient como bloqueado por opt-out superveniente. */
export async function blockRecipientByOptOut(recipientId: string, campaignId: string) {
  await db
    .from('crm_campaign_recipients')
    .update({ status: 'excluded', exclusion_reason: 'commercial_opt_out', delivery_mode: null })
    .eq('id', recipientId).eq('campaign_id', campaignId).eq('status', 'pending');
  await refreshCampaignCounters(campaignId);
}

/** Confirmação manual guiada: CAS impede sobrescrever enviado/pulado por outra aba. */
export async function markRecipientSent(recipientId: string, campaignId: string) {
  const { data, error } = await db
    .from('crm_campaign_recipients')
    .update({ status: 'sent', sent_at: new Date().toISOString() })
    .eq('id', recipientId).eq('campaign_id', campaignId)
    .eq('status', 'pending').eq('delivery_mode', 'manual')
    .select('id').maybeSingle();
  if (error || !data) {
    toast.error(error?.message || 'Destinatário já processado em outra sessão. Atualize a fila.');
    return false;
  }
  await refreshCampaignCounters(campaignId);
  return true;
}

/** Pular só é permitido em recipient ainda pendente e manual. */
export async function markRecipientSkipped(recipientId: string, campaignId: string) {
  const { data, error } = await db
    .from('crm_campaign_recipients')
    .update({ status: 'skipped' })
    .eq('id', recipientId).eq('campaign_id', campaignId)
    .eq('status', 'pending').eq('delivery_mode', 'manual')
    .select('id').maybeSingle();
  if (error || !data) {
    toast.error(error?.message || 'Destinatário já processado em outra sessão. Atualize a fila.');
    return false;
  }
  await refreshCampaignCounters(campaignId);
  return true;
}

/** Lê o corpo JSON de um erro da Edge Function (supabase-js embala a Response em error.context). */
async function readFunctionErrorBody(error: unknown): Promise<any | null> {
  const ctx = (error as any)?.context;
  if (!ctx) return null;
  try {
    if (typeof ctx.json === 'function') return await ctx.clone().json();
  } catch { /* corpo não-JSON */ }
  return typeof ctx === 'object' ? ctx : null;
}

/**
 * Códigos que significam "não dá para enviar por API agora", e não falha definitiva.
 * Nestes casos o recipient volta para a fila manual, permanecendo elegível e pendente.
 */
const MANUAL_FALLBACK_CODES = new Set([
  'template_required',
  'not_configured',
  'window_closed',
  'reengagement_required',
  '131047',
  '131026',
  '470',
]);

function isManualFallback(code: string | null, message: string | null): boolean {
  if (code && MANUAL_FALLBACK_CODES.has(String(code))) return true;
  const text = `${code || ''} ${message || ''}`.toLowerCase();
  return /template|janela de atendimento|24 horas|re-?engagement|outside.*window/.test(text);
}

/**
 * FRENTE 3.4 — Envio API controlado.
 * Processa sequencialmente apenas recipients api/pending, reutilizando a Edge Function
 * whatsapp-send em mode: 'campaign' (sem pós-atendimento da Inbox).
 */
export async function sendCampaignViaApi(
  campaign: { id: string; status: string },
  onProgress?: (done: number, total: number) => void,
): Promise<{ sent: number; failed: number; movedToManual: number; blocked: number; unconfirmed: number; alreadyProcessed: number }> {
  // O status em cache não dá direito de repetir uma campanha já concluída.
  const { data: liveCampaign, error: campaignError } = await db.from('crm_campaigns')
    .select('status').eq('id', campaign.id).maybeSingle();
  if (campaignError || !liveCampaign || !['prepared', 'sending'].includes(liveCampaign.status)) {
    throw new Error('Campanha não está preparada ou já foi concluída/cancelada. Atualize a tela.');
  }
  const { data, error: queueError } = await db
    .from('crm_campaign_recipients')
    .select('id, contact_id, conversation_id, rendered_message, status, delivery_mode')
    .eq('campaign_id', campaign.id).eq('status', 'pending').eq('delivery_mode', 'api');
  if (queueError) throw queueError;

  const queue = (data || []) as CrmCampaignRecipient[];
  const result = { sent: 0, failed: 0, movedToManual: 0, blocked: 0, unconfirmed: 0, alreadyProcessed: 0 };
  if (queue.length === 0) return result;

  if (liveCampaign.status === 'prepared') {
    const { error: statusError } = await db.from('crm_campaigns')
      .update({ status: 'sending', updated_at: new Date().toISOString() })
      .eq('id', campaign.id).eq('status', 'prepared');
    if (statusError) throw statusError;
  }

  const blockedOptOut = await revalidateOptOut(queue.map(r => r.contact_id));

  let done = 0;
  for (const r of queue) {
    if (blockedOptOut.has(r.contact_id)) {
      const { data: excluded } = await db.from('crm_campaign_recipients')
        .update({ status: 'excluded', exclusion_reason: 'commercial_opt_out', delivery_mode: null })
        .eq('id', r.id).eq('campaign_id', campaign.id).eq('status', 'pending')
        .select('id').maybeSingle();
      if (excluded) result.blocked++; else result.alreadyProcessed++;
      onProgress?.(++done, queue.length);
      continue;
    }
    if (!r.conversation_id) {
      const { data: moved } = await db.from('crm_campaign_recipients')
        .update({ delivery_mode: 'manual' })
        .eq('id', r.id).eq('campaign_id', campaign.id).eq('status', 'pending')
        .select('id').maybeSingle();
      if (moved) result.movedToManual++; else result.alreadyProcessed++;
      onProgress?.(++done, queue.length);
      continue;
    }

    // F0-B: a Edge Function possui a reserva atômica real. Envia-se um ID
    // específico; qualquer segunda aba recebe campaign_recipient_not_pending.
    let res: any = null;
    let error: any = null;
    try {
      const reply = await supabase.functions.invoke('whatsapp-send', {
        body: {
          mode: 'campaign', campaign_id: campaign.id, recipient_id: r.id,
          conversation_id: r.conversation_id, message: r.rendered_message || '',
        },
      });
      res = reply.data;
      error = reply.error;
    } catch (e) {
      error = e;
    }

    const payload: any = res ?? (await readFunctionErrorBody(error));
    const errorCode = String(payload?.code ?? '');
    const errorMessage = payload?.error || error?.message || 'Resposta da integração não confirmada';

    if (!error && payload?.ok && payload.recipient_id === r.id) {
      // O servidor já confirmou status='sent' antes de responder.
      result.sent++;
    } else if (isManualFallback(errorCode, errorMessage)) {
      // Fallback comprovadamente pré-envio; atualizar só se ainda pending.
      const { data: moved } = await db.from('crm_campaign_recipients').update({
        delivery_mode: 'manual', status: 'pending', error_code: null, error_message: null,
      }).eq('id', r.id).eq('campaign_id', campaign.id).eq('status', 'pending')
        .select('id').maybeSingle();
      if (moved) result.movedToManual++; else result.alreadyProcessed++;
    } else if (errorCode === 'commercial_opt_out') {
      const { data: excluded } = await db.from('crm_campaign_recipients')
        .update({ status: 'excluded', exclusion_reason: 'commercial_opt_out', delivery_mode: null })
        .eq('id', r.id).eq('campaign_id', campaign.id).eq('status', 'pending')
        .select('id').maybeSingle();
      if (excluded) result.blocked++; else result.alreadyProcessed++;
    } else if (errorCode === 'campaign_recipient_not_pending') {
      // Concorrência legítima com outra aba: não sobrescrever seu resultado.
      result.alreadyProcessed++;
    } else {
      // Timeout/resposta perdida não permite repetir um disparo: se o servidor
      // chegou a iniciar, o claim já está failed/dispatch_unconfirmed.
      // Se erro ocorreu antes do claim, colocar pending em quarentena também.
      await db.from('crm_campaign_recipients').update({
        status: 'failed', error_code: CAMPAIGN_UNCONFIRMED_CODE,
        error_message: `Falha ou resultado incerto: ${errorMessage}. Confira o provedor antes de reenviar.`,
      }).eq('id', r.id).eq('campaign_id', campaign.id).eq('status', 'pending');
      result.unconfirmed++;
      result.failed++;
    }
    onProgress?.(++done, queue.length);
    await new Promise(resolve => setTimeout(resolve, 400));
  }

  await refreshCampaignCounters(campaign.id);
  const { count } = await db.from('crm_campaign_recipients')
    .select('id', { count: 'exact', head: true })
    .eq('campaign_id', campaign.id).eq('status', 'pending');
  if (count === 0) {
    await db.from('crm_campaigns')
      .update({ status: 'completed', updated_at: new Date().toISOString() })
      .eq('id', campaign.id).eq('status', 'sending');
  }
  return result;
}

/**
 * Reenfileira recipients com falha: volta a pending, recalcula delivery_mode
 * (api só se houver conversa com janela de 24h aberta) e limpa o erro.
 * Nenhuma mensagem é enviada aqui.
 */
export async function requeueFailedRecipients(campaignId: string): Promise<number> {
  const { data, error: listError } = await db.from('crm_campaign_recipients')
    .select('id, contact_id, conversation_id, status, error_code, service_message_id, external_message_id')
    .eq('campaign_id', campaignId).eq('status', 'failed');
  if (listError) throw listError;
  // Falhas sem prova negativa do envio NÃO podem ser reencaminhadas.
  const rows = ((data || []) as CrmCampaignRecipient[]).filter(canSafelyRequeueCampaignRecipient);
  if (!rows.length) return 0;

  const convIds = [...new Set(rows.map(r => r.conversation_id).filter(Boolean))] as string[];
  const convMap = new Map<string, { id: string; last_inbound_at: string | null }>();
  for (let i = 0; i < convIds.length; i += 200) {
    const { data: convs, error: convError } = await db.from('service_conversations')
      .select('id, last_inbound_at').in('id', convIds.slice(i, i + 200));
    if (convError) throw convError;
    (convs || []).forEach((c: any) => convMap.set(c.id, c));
  }

  const blocked = await revalidateOptOut(rows.map(r => r.contact_id));
  let updated = 0;
  for (const r of rows) {
    // CAS: não sobrescreve registro que outra aba tenha concluído neste meio-tempo.
    const query = db.from('crm_campaign_recipients')
      .update(blocked.has(r.contact_id)
        ? { status: 'excluded', exclusion_reason: 'commercial_opt_out', delivery_mode: null }
        : {
          status: 'pending', error_code: null, error_message: null,
          delivery_mode: resolveDeliveryMode(r.conversation_id ? convMap.get(r.conversation_id) : null),
        })
      .eq('id', r.id).eq('campaign_id', campaignId)
      .eq('status', 'failed').eq('error_code', r.error_code)
      .is('service_message_id', null).is('external_message_id', null);
    const { data: changed, error: changeError } = await query.select('id').maybeSingle();
    if (changeError) throw changeError;
    if (changed && !blocked.has(r.contact_id)) updated++;
  }
  await refreshCampaignCounters(campaignId);
  if (updated > 0) {
    // Campanha anteriormente encerrada com falhas seguras pode voltar à fila
    // PREPARADA; reenvio ainda exige confirmação explícita pelo operador.
    await db.from('crm_campaigns').update({ status: 'prepared', updated_at: new Date().toISOString() })
      .eq('id', campaignId).eq('status', 'completed');
  }
  return updated;
}

export async function fetchCampaignRecipients(campaignId: string) {
  const { data, error } = await db
    .from('crm_campaign_recipients')
    .select('*, contact:contacts(id, name, commercial_opt_out)')

    .eq('campaign_id', campaignId)
    .order('status', { ascending: true });
  if (error) { toast.error(error.message); return []; }
  return (data || []) as (CrmCampaignRecipient & { contact?: { name?: string } })[];
}
