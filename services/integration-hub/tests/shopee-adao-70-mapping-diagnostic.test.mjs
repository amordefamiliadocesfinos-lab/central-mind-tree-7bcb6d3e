import test from 'node:test';
import assert from 'node:assert/strict';
import { previewAdaoMappings70 } from '../src/shopee-adao-70-mapping-diagnostic.mjs';
import { expectedTrufasComponents } from '../src/shopee-trufas-physical-reconciliation.mjs';
import { SHOPEE_TRUFAS_ADAO_REFERENCE_20261029 } from '../src/shopee-trufas-adao-reference-20261029.mjs';

test('unavailable catalog fails closed without any write',async()=>{
  const result=await previewAdaoMappings70({readBatch:async()=>({ok:false,status:503})});
  assert.equal(result.ok,false);
  assert.equal(result.code,'mapping_catalog_unavailable');
  assert.equal(result.written,0);
});
test('wrong account catalog fails closed',async()=>{
  const result=await previewAdaoMappings70({readBatch:async()=>({ok:true,payload:{marketplace_account:'SHOPEE VIVIANE',mappings:[]}})});
  assert.equal(result.ok,false);
  assert.equal(result.written,0);
});
test('empty catalog cannot be misreported as 70/70',async()=>{
  const result=await previewAdaoMappings70({readBatch:async()=>({ok:true,payload:{marketplace_account:'SHOPEE ADÃO',mappings:[]}})});
  assert.equal(result.selected,70);
  assert.equal(result.recognized,0);
  assert.equal(result.components_verified,0);
  assert.equal(result.written,0);
});
test('expected T30/T40 reference contains 60 identities and 120 components',()=>{
  const rows=expectedTrufasComponents(SHOPEE_TRUFAS_ADAO_REFERENCE_20261029);
  assert.equal(rows.length,60);
  assert.equal(rows.reduce((n,r)=>n+r.components.length,0),120);
});
