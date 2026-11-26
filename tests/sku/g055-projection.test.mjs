import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const projection = JSON.parse(readFileSync('src/data/sellerSkuG055Projection.json', 'utf8'));
const canonical = JSON.parse(readFileSync('docs/operations/jornada-sku-v13/sku-v13-168-models-core-projection.json', 'utf8'));

test('G05.5 UI carries only the 168 exact preapproved mapping identities', () => {
  assert.equal(projection.rows.length, 168);
  assert.equal(canonical.rows.length, 168);
  const map = new Map(canonical.rows.map(row => [row.mapping_id, row]));
  assert.equal(map.size, 168);
  const keys = new Set();
  for (const row of projection.rows) {
    const source = map.get(row.mapping_id);
    assert.ok(source, 'missing mapping in canonical source');
    for (const key of ['account','channel_account_id','item_id','model_id','architecture','canonical_sku','reconciliation_status']) {
      assert.equal(row[key], source[key], key + ': ' + row.mapping_id);
    }
    const official = [row.channel_account_id,row.item_id,row.model_id].join('|');
    assert.ok(!keys.has(official), 'duplicate official identity');
    keys.add(official);
    assert.match(row.canonical_sku, /^AF-TRF(30|40)-KT-(030|060|120)-[A-Z]{2,4}$/);
  }
  assert.equal(keys.size, 168);
});

test('G05.5 never erases the 24 protected physical exceptions', () => {
  const accounts = new Map();
  for (const row of projection.rows) {
    const list = accounts.get(row.account) ?? [];
    list.push(row);
    accounts.set(row.account,list);
  }
  assert.equal(accounts.size, 4);
  const skus = new Set(projection.rows.map(r => r.canonical_sku));
  assert.equal(skus.size, 42);
  for (const rows of accounts.values()) {
    assert.equal(rows.length, 42);
    assert.equal(rows.filter(r => r.reconciliation_status === 'BLOQUEADO_LOCAL').length, 6);
    assert.equal(rows.filter(r => r.reconciliation_status === 'PLANEJADO').length, 36);
    assert.deepEqual(new Set(rows.map(r=>r.canonical_sku)), skus);
  }
  assert.equal(projection.rows.filter(r => r.reconciliation_status === 'BLOQUEADO_LOCAL').length, 24);
  assert.equal(projection.rows.filter(r => r.reconciliation_status === 'PLANEJADO').length, 144);
  const pilot = projection.rows.find(r => r.mapping_id === '980cb680-5296-4342-b83d-4e09584a3fe0');
  assert.equal(pilot?.canonical_sku, 'AF-TRF30-KT-030-BRG');
  assert.equal(pilot?.model_id, '129843489972');
  assert.equal(pilot?.reconciliation_status, 'PLANEJADO');
});
