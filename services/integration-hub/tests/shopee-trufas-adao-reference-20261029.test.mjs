import test from 'node:test';
import assert from 'node:assert/strict';
import { previewTrufasMappings } from '../src/shopee-trufas-reconciliation-preview.mjs';
import { SHOPEE_TRUFAS_ADAO_ACCOUNT_ID as ACCOUNT,
  SHOPEE_TRUFAS_ADAO_REFERENCE_20261029 as REF
} from '../src/shopee-trufas-adao-reference-20261029.mjs';
test('all 60 official model identities are unique and ready for read-only reconciliation',()=>{
  assert.equal(REF.length,60);
  assert.equal(REF.filter(r=>r.family==='T30').length,30);
  assert.equal(REF.filter(r=>r.family==='T40').length,30);
  assert.equal(new Set(REF.map(r=>r.item_id+'|'+r.model_id)).size,60);
  assert.equal(new Set(REF.map(r=>r.seller_sku_observed).filter(Boolean)).size,59);
  assert.equal(REF.filter(r=>r.seller_sku_observed===null).length,1);
  assert.equal(REF.find(r=>r.item_id==='20999760944').seller_sku_observed,null);
  const out=previewTrufasMappings(REF,[],ACCOUNT);
  assert.equal(out.selected,60);
  assert.equal(out.missing,60);
  assert.equal(out.duplicate,0);
  assert.equal(out.writes,false);
});
test('T30 and T40 reference quantities and unique flavors are complete',()=>{
  const combos=REF.filter(r=>r.kind==='KT'||r.kind==='AT');
  assert.equal(combos.length,56);
  for(const family of ['T30','T40']) for(const kind of ['KT','AT']){
    const rows=REF.filter(r=>r.family===family&&r.kind===kind);
    assert.equal(rows.length,kind==='KT'?21:7);
    for(const qty of (kind==='KT'?[30,60,120]:[60])){
      assert.deepEqual(new Set(rows.filter(r=>r.qty===qty).map(r=>r.flavor)),
        new Set(['MX','BRG','AMD','MOR','MAR','BEI','LEP']));
    }
  }
});
