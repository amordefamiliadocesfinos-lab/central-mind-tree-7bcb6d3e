import {
  CRM_LIVE_CONTEXT_VERSION,
  needsCrmLiveContextBootstrap,
  normalizeCrmLiveContextMemory,
  type CrmContactLiveContext,
} from './liveContext';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`IA-07.1 Contexto Vivo: ${message}`);
}

const valid: CrmContactLiveContext = {
  contactId: 'contact-1', summary: 'Cliente compra mensalmente.',
  memory: { preferences: ['Chocolate branco'], purchase_pattern: { approximate_frequency_days: 30, last_purchase_at: '2026-09-01T00:00:00.000Z' } },
  sourceEventAt: '2026-09-01T00:00:00.000Z', updatedAt: '2026-09-01T00:00:00.000Z', version: CRM_LIVE_CONTEXT_VERSION,
};

const memory = normalizeCrmLiveContextMemory({
  preferences: [' Chocolate branco ', 'Chocolate branco', 1],
  objections: ['Preço'],
  purchase_pattern: { approximate_frequency_days: '30.4', recurring_product_ids: ['p1', 'p1'], last_purchase_at: '2026-09-01T00:00:00.000Z' },
  ignored_canonical_stage: 'negociacao',
});
assert(memory.preferences?.length === 1 && memory.preferences[0] === 'Chocolate branco', 'preferências devem ser normalizadas sem inventar dados.');
assert(memory.purchase_pattern?.approximate_frequency_days === 30, 'frequência comprovada deve ser normalizada.');
assert(!('ignored_canonical_stage' in memory), 'campos canônicos não pertencem à memória interpretativa.');
assert(needsCrmLiveContextBootstrap(null), 'ausência de contexto exige bootstrap.');
assert(!needsCrmLiveContextBootstrap(valid), 'contexto atual não deve reconstruir histórico.');
assert(needsCrmLiveContextBootstrap({ ...valid, version: 0 }), 'versão incompatível exige bootstrap controlado.');

console.log('liveContext.test: OK');
