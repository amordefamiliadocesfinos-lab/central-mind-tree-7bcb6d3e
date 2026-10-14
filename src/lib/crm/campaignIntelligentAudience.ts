import type { EligibilityContact } from './campaignEligibility';
import type { PostSalePanelLifecycleInsight } from './postSalePanelLifecycle';

export type CrmCampaignAudienceMode = 'traditional' | 'post_sale' | 'repurchase_probable';
export const CRM_CAMPAIGN_INTELLIGENCE_MAX_CONTACTS = 60;

export interface CrmCampaignAudienceResult<T extends EligibilityContact> {
  /** Contatos que satisfazem o mesmo resolvedor da F3 do Assistente CRM. */
  matched: T[];
  evaluatedCount: number;
  signalCount: number;
  restrictedCount: number;
  verifiedAt: string;
}

export function matchesCampaignAudience(
  mode: Exclude<CrmCampaignAudienceMode, 'traditional'>,
  insight: PostSalePanelLifecycleInsight,
): boolean {
  if (insight.restricted || !insight.readOnly) return false;
  if (mode === 'post_sale') return insight.opportunity.kind === 'post_sale'
    && insight.opportunity.postSale?.eligible === true;
  return insight.opportunity.kind === 'repurchase'
    && insight.opportunity.repurchase?.status === 'probable';
}

/**
 * F5-A: a qualificação é opcional, explícita e apenas leitura.
 * Nenhum sinal ou erro gera inclusão presumida. Falha em qualquer consulta
 * invalida o lote inteiro (não permite criar rascunho a partir de amostra).
 * Limite + concorrência controlam custo e carga no CRM.
 */
export async function analyzeCrmCampaignAudience<T extends EligibilityContact>(
  contacts: readonly T[],
  mode: Exclude<CrmCampaignAudienceMode, 'traditional'>,
  loadInsight: (contactId: string) => Promise<PostSalePanelLifecycleInsight>,
  maxContacts = CRM_CAMPAIGN_INTELLIGENCE_MAX_CONTACTS,
): Promise<CrmCampaignAudienceResult<T>> {
  const unique = [...new Map(contacts.map(c => [c.id, c])).values()];
  if (!unique.length) throw new Error('O segmento está vazio. Ajuste os filtros antes de analisar.');
  if (unique.length > maxContacts) {
    throw new Error(`Refine os filtros para até ${maxContacts} contatos antes de analisar. Nenhuma seleção parcial será usada.`);
  }
  const decisions: { matched: boolean; hasSignal: boolean; restricted: boolean }[] = [];
  let cursor = 0;
  async function worker() {
    while (cursor < unique.length) {
      const index = cursor++;
      const contact = unique[index];
      if (!contact?.id) throw new Error('Segmento com identidade incompleta.');
      const insight = await loadInsight(contact.id);
      // Contato marcado no snapshot como opt-out também não pode ser incluído.
      const restricted = insight.restricted || contact.commercial_opt_out === true
        || (('is_active' in contact) && contact.is_active !== true);
      const hasSignal = matchesCampaignAudience(mode, { ...insight, restricted: false });
      decisions[index] = {
        matched: !restricted && hasSignal,
        restricted,
        hasSignal,
      };
    }
  }
  await Promise.all(Array.from({ length: Math.min(2, unique.length) }, () => worker()));
  return {
    matched: unique.filter((_, index) => decisions[index]?.matched),
    evaluatedCount: unique.length,
    signalCount: decisions.filter(x => x.hasSignal).length,
    restrictedCount: decisions.filter(x => x.restricted).length,
    verifiedAt: new Date().toISOString(),
  };
}

export function sameCampaignAudienceContacts(
  a: readonly EligibilityContact[],
  b: readonly EligibilityContact[],
): boolean {
  if (a.length !== b.length) return false;
  const ids = new Set(a.map(c => c.id));
  return ids.size === a.length && b.every(c => ids.has(c.id));
}
