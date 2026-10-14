import { analyzeCrmCampaignAudience, matchesCampaignAudience, sameCampaignAudienceContacts } from './campaignIntelligentAudience';
import type { PostSalePanelLifecycleInsight } from './postSalePanelLifecycle';
import type { EligibilityContact } from './campaignEligibility';

const assert = (value: unknown, reason: string): asserts value => {
  if (!value) throw new Error(`CRM F5-A: ${reason}`);
};
const postSale = (restricted = false): PostSalePanelLifecycleInsight => ({
  readOnly: true, restricted, opportunity: {
    kind: 'post_sale', reason: 'Pós-venda elegível',
    postSale: { eligible: true, orderId: 'order1', deliveryDate: '2026-10-10', reason: 'Entregue' },
    repurchase: null,
  },
});
const repurchase = (status: 'explicit' | 'probable'): PostSalePanelLifecycleInsight => ({
  readOnly: true, restricted: false, opportunity: {
    kind: 'repurchase', reason: 'Padrão recorrente',
    postSale: null,
    repurchase: {
      status, confidence: status === 'explicit' ? 'high' : 'medium',
      lastPurchaseAt: '2026-10-01', purchaseCount: 4, typicalIntervalDays: 30,
      daysSinceLastPurchase: 27, likelyProducts: [], reason: 'Compras recorrentes',
    },
  },
});
const contacts: EligibilityContact[] = [
  { id: '1', name: 'A', commercial_opt_out: false },
  { id: '2', name: 'B', commercial_opt_out: false },
  { id: '3', name: 'C', commercial_opt_out: true },
  { id: '4', name: 'D', commercial_opt_out: false },
];
const facts = new Map<string, PostSalePanelLifecycleInsight>([
  ['1', postSale()], ['2', repurchase('probable')],
  ['3', postSale()], ['4', repurchase('explicit')],
]);
const load = async (id: string) => facts.get(id)!;
assert(matchesCampaignAudience('post_sale', postSale()), 'pós-venda verificado deve passar');
assert(!matchesCampaignAudience('post_sale', postSale(true)), 'opt-out rejeitado');
assert(!matchesCampaignAudience('repurchase_probable', repurchase('explicit')),
  'intenção explícita deve seguir Inbox, não campanha proativa');
assert(matchesCampaignAudience('repurchase_probable', repurchase('probable')),
  'recompra histórica sustentada passa');
const run = async () => {
  const post = await analyzeCrmCampaignAudience(contacts, 'post_sale', load);
  assert(post.evaluatedCount === 4 && post.signalCount === 2 && post.restrictedCount === 1
    && sameCampaignAudienceContacts(post.matched, [contacts[0]]),
    'pós-venda usa apenas elegíveis e respeita opt-out');
  const rep = await analyzeCrmCampaignAudience(contacts, 'repurchase_probable', load);
  assert(sameCampaignAudienceContacts(rep.matched, [contacts[1]]),
    'recompra explícita não entra em campanha provável');
  const duplicate = await analyzeCrmCampaignAudience([contacts[0], contacts[0]], 'post_sale', load);
  assert(duplicate.evaluatedCount === 1, 'identidades repetidas não inflam lote');
  assert(!sameCampaignAudienceContacts([contacts[0]], [contacts[1]]),
    'nova seleção exige conferência');
  assert(!sameCampaignAudienceContacts([contacts[0], contacts[0]], [contacts[0]]),
    'duplicações não validam identidade');
  let failed = false;
  try {
    await analyzeCrmCampaignAudience(contacts, 'post_sale', async id => {
      if (id === '2') throw new Error('indisponível');
      return load(id);
    });
  } catch { failed = true; }
  assert(failed, 'erro em um só contato invalida toda a análise');
  failed = false;
  try { await analyzeCrmCampaignAudience(contacts, 'post_sale', load, 3); }
  catch { failed = true; }
  assert(failed, 'amostras incompletas não devem ser usadas como segmentos');
  console.log('campaignIntelligentAudience.test: OK');
};
await run();
