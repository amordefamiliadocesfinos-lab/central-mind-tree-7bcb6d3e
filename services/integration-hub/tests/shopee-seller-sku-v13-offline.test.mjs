import test from 'node:test';
import assert from 'node:assert/strict';
import { buildShopeeMappingPreview } from '../src/shopee-mapping-preview.mjs';

// Jornada SKU V1.3: o Seller SKU é evidência mutável, não identidade de mapping.
// Contraprovas offline, sem consultar Shopee ou ativar intake/commit.
const ACCOUNT = 'd26c7a30-aa4a-4441-8012-600d70453689'; // Celivio
const OTHER = '8a8ad166-0317-4597-8be6-e43fb46b4d1b'; // Viviane
const ITEM = '23094148715';
const MODEL = '129843489972';
const KEY = 'official:item:23094148715|model:129843489972';
const mappings = [{
  id: '980cb680-5296-4342-b83d-4e09584a3fe0',
  marketplace: 'shopee',
  marketplace_account: 'SHOPEE CELIVIO',
  channel_account_id: ACCOUNT,
  external_item_id: ITEM,
  external_model_id: MODEL,
  external_item_key: KEY,
  product_id: '183c7829-8537-439c-9a90-1a762766c089',
  variant_id: '398f0e5a-1528-40f9-a1d5-2d829f7abca5',
  physical_multiplier: 30,
  components: [{
    product_id: '183c7829-8537-439c-9a90-1a762766c089',
    variant_id: '398f0e5a-1528-40f9-a1d5-2d829f7abca5',
    physical_multiplier: 30,
    position: 0,
  }],
}];
function preview(modelSku, { channelAccountId=ACCOUNT, itemId=ITEM, modelId=MODEL }={}) {
  const item = {
    itemId, modelId, itemSku: null, modelSku,
    itemName: 'Trufa Artesanal 30 g', modelName: '30 UNI,Brigadeiro',
    quantity: 1,
  };
  return buildShopeeMappingPreview({
    source: 'shopee_open_platform',
    environment: 'live',
    channelAccountId,
    orders: [{orderSn:'offline-fixture', externalStatus:'READY_TO_SHIP',items:[item]}],
  }, mappings, { channelAccountId, marketplaceAccount:'SHOPEE CELIVIO' });
}
test('sem Seller SKU, com AF e com VIV: mesmo mapping e 30 unidades fisicas', ()=>{
  const states=[null,'AF-TRF30-KT-030-BRG','VIV-TR30-030-BRG'].map(s=>preview(s));
  for(const s of states){
    assert.equal(s.operationalWrites,false);
    const item=s.orders[0].items[0];
    assert.equal(item.mappingStatus,'recognized');
    assert.equal(item.mappingId,mappings[0].id);
    assert.equal(item.components.length,1);
    assert.equal(item.components[0].physicalQuantity,30);
  }
});
test('mudanca de conta nao reconhece mapping de Celivio', ()=>{
  const m=preview('AF-TRF30-KT-030-BRG',{channelAccountId:OTHER}).orders[0].items[0];
  assert.notEqual(m.mappingStatus,'recognized');
});
test('Model desconhecido com mesmo Seller SKU nao herda identidade de outro Model', ()=>{
  const m=preview('AF-TRF30-KT-030-BRG',{modelId:'999999999999'}).orders[0].items[0];
  assert.notEqual(m.mappingStatus,'recognized');
});
test('Item desconhecido com mesmo Seller SKU nao herda identidade de outro Item', ()=>{
  const m=preview('AF-TRF30-KT-030-BRG',{itemId:'999999999999'}).orders[0].items[0];
  assert.notEqual(m.mappingStatus,'recognized');
});
test('identidade oficial nao muda com Seller SKU divergente', ()=>{
  const m=preview('SKU-ERRADO').orders[0].items[0];
  assert.equal(m.mappingStatus,'recognized');
  assert.equal(m.itemId,ITEM);
  assert.equal(m.modelId,MODEL);
});
