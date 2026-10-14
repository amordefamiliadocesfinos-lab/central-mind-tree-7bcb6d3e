import { supabase } from '@/integrations/supabase/client';
import {
  analyzeCrmCampaignAudience,
  type CrmCampaignAudienceMode,
} from './campaignIntelligentAudience';
import { loadPostSalePanelLifecycleInsight } from './postSalePanelLifecycle';

/**
 * F5-B: a fotografia gravada em segment_filters NÃO autoriza envio futuro.
 * Toda preparação e abertura de envio de campanha inteligente exige leitura
 * atual do banco oficial, de TODOS os recipients pendentes relevantes.
 * Não cria mensagem, não altera status, não reenfileira e não faz bootstrap IA.
 */
export async function verifyCurrentIntelligentCampaignAudience(
  campaignId: string,
  specificRecipientIds?: string[],
): Promise<void> {
  const db = supabase as any;
  const { data: campaign, error: campaignError } = await db.from('crm_campaigns')
    .select('id,segment_filters')
    .eq('id', campaignId)
    .maybeSingle();
  if (campaignError || !campaign) throw new Error('Não foi possível conferir a campanha atual.');

  const mode = campaign.segment_filters?.crm_lifecycle_criterion as CrmCampaignAudienceMode | undefined;
  if (!mode) return; // campanhas tradicionais continuam sob as regras atuais
  if (mode !== 'post_sale' && mode !== 'repurchase_probable') {
    throw new Error('Critério inteligente desconhecido. Envio bloqueado até revisão.');
  }

  let query = db.from('crm_campaign_recipients')
    .select('id,contact_id')
    .eq('campaign_id', campaignId)
    .eq('status', 'pending');
  if (specificRecipientIds) {
    if (!specificRecipientIds.length) return;
    query = query.in('id', specificRecipientIds);
  }
  const { data: recipients, error: recipientError } = await query;
  if (recipientError) throw new Error('Não foi possível conferir a lista atual de destinatários.');
  const ids = [...new Set((recipients ?? []).map((r: any) => r.contact_id).filter(Boolean))] as string[];
  if (!ids.length) return;

  const { data: contacts, error: contactError } = await db.from('contacts')
    .select('id,is_active,commercial_opt_out')
    .in('id', ids);
  if (contactError || (contacts ?? []).length !== ids.length) {
    throw new Error('Contato ausente ou indisponível. Campanha inteligente bloqueada até revisão.');
  }

  const analyzed = await analyzeCrmCampaignAudience(
    contacts as { id: string; is_active: boolean; commercial_opt_out: boolean | null }[],
    mode,
    loadPostSalePanelLifecycleInsight,
  );
  if (analyzed.matched.length !== ids.length) {
    throw new Error(
      'O público inteligente mudou: há destinatários sem sinal atual ou com restrição comercial. Revise e crie um segmento atualizado antes de continuar.',
    );
  }
}
