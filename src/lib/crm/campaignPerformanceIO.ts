/**
 * F5-D: leitura dos indicadores de cada campanha a partir de estruturas oficiais.
 * Não grava em campanhas, CRM, Operações nem Financeiro.
 */
import { supabase } from '@/integrations/supabase/client';
import { countCampaignResponses } from './campaignContext';
import { loadCrmCampaignSales } from './campaignSalesIO';
import type { CampaignPerformance } from './campaignPerformance';

const db = supabase as any;

async function recipientStatusCounts(campaignId: string) {
  const rows: { id: string; status: string }[] = [];
  // Paginação explícita: a maioria das campanhas tem muitos pendentes
  // (PostgREST pode truncar silenciosamente resultados não paginados).
  for (let offset = 0; offset < 20000; offset += 500) {
    const { data, error } = await db.from('crm_campaign_recipients')
      .select('id,status').eq('campaign_id', campaignId)
      .order('id', { ascending: true }).range(offset, offset + 499);
    if (error || !Array.isArray(data)) throw new Error('Status de destinatários indisponíveis.');
    rows.push(...(data as { id: string; status: string }[]));
    if (data.length < 500) {
      if (new Set(rows.map(r => r.id)).size !== rows.length) {
        throw new Error('Destinatários duplicados ou alterados durante a leitura.');
      }
      return {
        sent: rows.filter(r => r.status === 'sent').length,
        pending: rows.filter(r => r.status === 'pending').length,
        excluded: rows.filter(r => r.status === 'excluded').length,
        failed: rows.filter(r => r.status === 'failed').length,
        skipped: rows.filter(r => r.status === 'skipped').length,
      };
    }
  }
  throw new Error('Volume de destinatários acima do limite seguro de consulta; não exibir total parcial.');
}

export async function loadCrmCampaignPerformance(input: {
  id: string; total_selected: number;
}): Promise<CampaignPerformance> {
  const [status, replies, sales] = await Promise.all([
    recipientStatusCounts(input.id),
    countCampaignResponses(input.id),
    loadCrmCampaignSales(input.id),
  ]);
  // Durante um envio, leituras separadas podem divergir. Nunca mostrar taxa
  // formada por denominador de um instante e numerador de outro.
  if (status.sent !== replies.sent || replies.responded > replies.sent) {
    throw new Error('A campanha mudou durante a leitura. Atualize os indicadores.');
  }
  return {
    campaignId: input.id,
    selectedAtCreation: input.total_selected,
    ...status,
    responded: replies.responded,
    sales,
  };
}
