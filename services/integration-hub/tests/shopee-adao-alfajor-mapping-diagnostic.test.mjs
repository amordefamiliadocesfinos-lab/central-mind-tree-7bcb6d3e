import test from 'node:test';
import assert from 'node:assert/strict';
import { previewAdaoAlfajorMappings, ADA0_ALFAJOR_ACCOUNT, EXPECTED, WHITE, DARK } from '../src/shopee-adao-alfajor-mapping-diagnostic.mjs';
const product = '62cf9f63-be04-4261-ad11-569028dd1125';
function mappings(account=ADA0_ALFAJOR_ACCOUNT) {
  return EXPECTED.map(([itemId,modelId,white,dark]) => ({
    id:modelId,marketplace:'shopee',channel_account_id:account,
    external_item_id:itemId,external_model_id:modelId,
    components: [[WHITE,white],[DARK,dark]].filter(([,q])=>q>0)
      .map(([variant_id,physical_multiplier],position)=>({
        product_id:product,variant_id,physical_multiplier,position,
        physical_identity:{active:true,unit:'un'}
      })),
  }));
}
async function check(rows=mappings(),account='SHOPEE ADÃO') {
  return previewAdaoAlfajorMappings({readBatch:async input=>{
    assert.deepEqual(input,{channel_account_id:ADA0_ALFAJOR_ACCOUNT,limit:1});
    return {ok:true,payload:{marketplace_account:account,mappings:rows}};
  }});
}
test('21/21 official IDs and physical compositions matched read-only',async()=>{
  const r=await check();
  assert.deepEqual([r.selected,r.recognized,r.blocked,r.written],[21,21,0,0]);
  for(const item of r.items){assert.equal(item.recognized,true);assert.deepEqual(item.actual,item.expected);}
});
test('missing mapping fails closed',async()=>{
  const r=await check(mappings().slice(1));assert.equal(r.blocked,1);assert.equal(r.written,0);
});
test('wrong account fails closed',async()=>{
  const r=await check(mappings('00000000-0000-4000-8000-000000000099'));assert.equal(r.recognized,0);
});
test('invalid physical composition fails closed',async()=>{
  const rows=mappings();rows[2].components[0].physical_multiplier=999;
  const r=await check(rows);assert.equal(r.blocked,1);assert.equal(r.written,0);
});
test('incorrect external item and model IDs fail closed',async()=>{
  const rows=mappings();rows[0].external_item_id='0';rows[1].external_model_id='0';
  const r=await check(rows);assert.equal(r.blocked,2);assert.equal(r.written,0);
});
test('unavailable catalog fails closed',async()=>{
  const r=await previewAdaoAlfajorMappings({readBatch:async()=>({ok:false})});
  assert.deepEqual(r,{ok:false,code:'mapping_catalog_unavailable',written:0});
});
