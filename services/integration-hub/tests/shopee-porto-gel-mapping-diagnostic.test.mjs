import test from 'node:test';
import assert from 'node:assert/strict';
import { previewPortoGelVivianeMappings, PORTO_GEL_VIVIANE_ACCOUNT } from '../src/shopee-porto-gel-mapping-diagnostic.mjs';

test('private diagnostic resolves all official Porto Gel variants without writers', async () => {
  const variants = [
    ['209190015956', [['1kg', 1]]],
    ['209190015957', [['1kg', 2]]],
    ['209190015958', [['3kg', 1]]],
    ['209190015959', [['3kg', 1], ['1kg', 1]]],
  ];
  let reads = 0;
  const result = await previewPortoGelVivianeMappings({
    readBatch: async (request) => {
      reads++;
      assert.deepEqual(request, { channel_account_id: PORTO_GEL_VIVIANE_ACCOUNT, limit: 1 });
      return { ok: true, payload: { marketplace_account: 'SHOPEE VIVIANE',
        mappings: variants.map(([modelId, components]) => ({
          id: modelId, marketplace: 'shopee', channel_account_id: PORTO_GEL_VIVIANE_ACCOUNT,
          external_item_id: '23399466897', external_model_id: modelId,
          components: components.map(([variant_id, physical_multiplier], position) => ({
            product_id: 'porto-gel', variant_id, physical_multiplier, position,
            physical_identity: { active: true, unit: 'un' },
          })),
        })),
      } };
    },
  });
  assert.equal(reads, 1);
  assert.equal(result.ok, true);
  assert.deepEqual([result.selected, result.recognized, result.blocked, result.written], [4, 4, 0, 0]);
  assert.deepEqual(result.items.map(x => x.components.map(c => [c.variant_id, c.physical_quantity])),
    variants.map(x => x[1]));
  assert.equal(result.items.every(x => x.mapping_status === 'recognized'), true);
});

test('private diagnostic fails closed when read is unavailable', async () => {
  const result = await previewPortoGelVivianeMappings({ readBatch: async () => ({ ok: false }) });
  assert.deepEqual(result, { ok: false, code: 'mapping_catalog_unavailable', written: 0 });
});
