import { analyzeCrmCampaignAudience } from './campaignIntelligentAudience';
import type { PostSalePanelLifecycleInsight } from './postSalePanelLifecycle';

function assert(value: unknown, message: string): asserts value {
  if (!value) throw new Error(`CRM F5-B: ${message}`);
}
const eligible: PostSalePanelLifecycleInsight = {
  readOnly: true, restricted: false, opportunity: {
    kind: 'post_sale', postSale: {
      eligible: true, orderId: 'order-1', deliveryDate: '2026-10-13', reason: 'Elegível',
    }, repurchase: null, reason: 'Elegível',
  },
};
async function test() {
  const rows = [
    { id: '1', is_active: true, commercial_opt_out: false },
    { id: '2', is_active: true, commercial_opt_out: false },
  ];
  const full = await analyzeCrmCampaignAudience(rows, 'post_sale', async () => eligible);
  assert(full.matched.length === 2, 'público íntegro permite preparação');
  const changed = await analyzeCrmCampaignAudience(rows, 'post_sale',
    async id => id === '1' ? eligible : { ...eligible, restricted: true });
  assert(changed.matched.length !== rows.length, 'opt-out superveniente bloqueia lista anterior');
  const inactive = await analyzeCrmCampaignAudience(
    [rows[0], { ...rows[1], is_active: false }], 'post_sale', async () => eligible);
  assert(inactive.matched.length !== rows.length, 'contato inativo nunca mantém elegibilidade');
  const after = await analyzeCrmCampaignAudience(rows, 'post_sale', async id =>
    id === '1' ? eligible : { ...eligible, opportunity: { ...eligible.opportunity, kind: 'none' as const } });
  assert(after.matched.length !== rows.length, 'pós-venda realizado após criação invalida público');
  console.log('campaignIntelligentSafety.test: OK');
}
await test();
