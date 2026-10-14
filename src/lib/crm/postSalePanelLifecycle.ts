import { buildCrmAiContext, defaultCrmAiContextSources } from './aiContext';
import { loadPostSaleEligibility } from './postSale';
import { calculateRepurchaseSignal, hasFutureCrmReactivation, loadRepurchaseOrders } from './repurchase';
import { resolveCrmLifecycleOpportunity, type CrmLifecycleOpportunity } from './lifecycleOpportunity';

export interface PostSalePanelLifecycleInsight {
  opportunity: CrmLifecycleOpportunity;
  /** Opt-out ativo não altera o fato, mas bloqueia a abordagem comercial. */
  restricted: boolean;
  /** Sinais são sugestões baseadas em fatos, não ações nem mensagens enviadas. */
  readOnly: true;
}

/**
 * Reutiliza exatamente a decisão F3-A / F3-B / F3-H do Assistente.
 * Passar um objeto de fontes COPIADO evita a inicialização com escrita
 * de memória interpretativa (ensureCrmLiveContext) do contexto padrão.
 * As consultas fornecidas pelo defaultCrmAiContextSources são de leitura.
 * Sem campanhas, tarefas, Resultado ou envio novo.
 */
export async function loadPostSalePanelLifecycleInsight(contactId: string): Promise<PostSalePanelLifecycleInsight> {
  if (!contactId) throw new Error('Contato obrigatório para analisar sinais.');
  const readOnlySources = { ...defaultCrmAiContextSources };
  const [context, orders, postSale] = await Promise.all([
    buildCrmAiContext(contactId, undefined, readOnlySources),
    loadRepurchaseOrders(contactId),
    loadPostSaleEligibility(contactId),
  ]);
  const repurchase = calculateRepurchaseSignal(context, orders);
  const eligibleRepurchase = hasFutureCrmReactivation(context)
    ? null : repurchase.status === 'none' ? null : repurchase;
  return {
    opportunity: resolveCrmLifecycleOpportunity(postSale, eligibleRepurchase),
    restricted: context.contact.optOut,
    readOnly: true,
  };
}
