/**
 * FRENTE 3.5 — Campanhas CRM: respostas → Inbox.
 *
 * Camada SOMENTE LEITURA. Não cria prioridade, não altera etapa, não registra
 * Resultado e não cria tarefa. Apenas identifica, a partir das estruturas já
 * existentes (crm_campaign_recipients + crm_campaigns), se um inbound recente
 * pode ser atribuído com segurança a uma campanha enviada.
 */
import { supabase } from '@/integrations/supabase/client';

const db = supabase as any;

/** Janela máxima entre o envio da campanha e a resposta do cliente. */
export const CAMPAIGN_RESPONSE_WINDOW_HOURS = 72;
/** Se duas campanhas foram enviadas muito próximas, o vínculo é ambíguo. */
const AMBIGUITY_MARGIN_MINUTES = 30;

export interface CampaignContext {
  campaignId: string;
  campaignName: string;
  recipientId: string;
  sentAt: string;
  /** true quando existe inbound posterior ao envio (resposta contabilizável). */
  responded: boolean;
}

interface RecipientRow {
  id: string;
  campaign_id: string;
  contact_id: string;
  conversation_id: string | null;
  sent_at: string | null;
  status: string;
  campaign?: { id: string; name: string } | null;
}

function hoursBetween(a: string, b: string): number {
  return Math.abs(new Date(a).getTime() - new Date(b).getTime()) / 36e5;
}

/**
 * Resolve o contexto de campanha de um contato para o atendimento atual.
 * Retorna null quando não há vínculo confiável (nenhum envio recente ou
 * ambiguidade clara entre campanhas) — nesse caso preserva-se o inbound normal.
 */
export async function resolveCampaignContext(params: {
  contactId: string;
  conversationId?: string | null;
  lastInboundAt?: string | null;
}): Promise<CampaignContext | null> {
  const { contactId, conversationId, lastInboundAt } = params;
  if (!contactId) return null;

  const { data, error } = await db
    .from('crm_campaign_recipients')
    .select('id, campaign_id, contact_id, conversation_id, sent_at, status, campaign:crm_campaigns(id,name)')
    .eq('contact_id', contactId)
    .eq('status', 'sent')
    .not('sent_at', 'is', null)
    .order('sent_at', { ascending: false })
    .limit(5);

  if (error || !data?.length) return null;

  const reference = lastInboundAt || new Date().toISOString();
  const plausible = (data as RecipientRow[]).filter((r) => {
    if (!r.sent_at) return false;
    // Envio deve ser anterior à referência e dentro da janela.
    if (new Date(r.sent_at).getTime() > new Date(reference).getTime()) return false;
    if (hoursBetween(r.sent_at, reference) > CAMPAIGN_RESPONSE_WINDOW_HOURS) return false;
    // Se o recipient tem conversa vinculada, ela precisa bater com a atual.
    if (conversationId && r.conversation_id && r.conversation_id !== conversationId) return false;
    return true;
  });

  if (!plausible.length) return null;

  const [first, second] = plausible;
  if (
    second &&
    second.campaign_id !== first.campaign_id &&
    first.sent_at &&
    second.sent_at &&
    hoursBetween(first.sent_at, second.sent_at) * 60 < AMBIGUITY_MARGIN_MINUTES
  ) {
    // Ambiguidade clara: não criar vínculo arbitrário.
    return null;
  }

  return {
    campaignId: first.campaign_id,
    campaignName: first.campaign?.name || 'Campanha',
    recipientId: first.id,
    sentAt: first.sent_at as string,
    responded: Boolean(lastInboundAt && new Date(lastInboundAt).getTime() > new Date(first.sent_at as string).getTime()),
  };
}

/**
 * Contagem de respostas de uma campanha calculada a partir dos dados existentes
 * (recipients enviados + last_inbound_at posterior ao envio). Sem coluna nova.
 */
export async function countCampaignResponses(campaignId: string): Promise<{ sent: number; responded: number }> {
  const { data } = await db
    .from('crm_campaign_recipients')
    .select('id, conversation_id, sent_at, status')
    .eq('campaign_id', campaignId)
    .eq('status', 'sent');

  const rows = (data || []) as RecipientRow[];
  const convIds = rows.map((r) => r.conversation_id).filter(Boolean) as string[];
  if (!convIds.length) return { sent: rows.length, responded: 0 };

  const { data: convs } = await db
    .from('service_conversations')
    .select('id, last_inbound_at')
    .in('id', convIds);

  const inboundById = new Map<string, string | null>((convs || []).map((c: any) => [c.id, c.last_inbound_at]));
  const responded = rows.filter((r) => {
    const inbound = r.conversation_id ? inboundById.get(r.conversation_id) : null;
    return Boolean(
      inbound && r.sent_at &&
      new Date(inbound).getTime() > new Date(r.sent_at).getTime() &&
      hoursBetween(inbound, r.sent_at) <= CAMPAIGN_RESPONSE_WINDOW_HOURS,
    );
  }).length;

  return { sent: rows.length, responded };
}
