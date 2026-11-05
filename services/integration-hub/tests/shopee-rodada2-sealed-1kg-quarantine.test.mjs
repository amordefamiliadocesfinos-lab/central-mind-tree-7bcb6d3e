import test from 'node:test';
import assert from 'node:assert/strict';
import {R2_ADAO_ACCOUNT_ID,R2_SEALED_PENDING,R2_RESERVED_ITEM_IDS,r2SealedPackageBlocker,r2RequiresOfficialIdentity} from '../src/shopee-rodada2-sealed-1kg-guard.mjs';
import {mappingPhysicalBlocker} from '../src/shopee-mapping-physical-guard.mjs';
import {buildShopeeMappingPreview} from '../src/shopee-mapping-preview.mjs';
const PAIRS=[
 ['23994544114','189613441090','AF-SORB-001KG','6f43ad65-74d5-4db9-b931-1ecd6d124987','r2_sorbato_original_sealed_package_unverified'],
 ['58211501155','219189984127','AF-ACID-001KG','ef118d1c-e7c7-45e3-b796-3a9908840f3c','r2_acido_original_sealed_package_unverified'],
];
function fixture(item,mappings=[],scope=R2_ADAO_ACCOUNT_ID){
 const normalized={source:'fixture',environment:'test',channelAccountId:scope,orders:[{orderSn:'R2-TEST',createdAt:'2026-11-04T12:00:00Z',items:[item]}]};
 return buildShopeeMappingPreview(normalized,mappings,{channelAccountId:scope,marketplaceAccount:'SHOPEE ADÃO',requirePhysicalValidation:true});
}
test('R2 guards only two exact, published Adão pairs',()=>{
 assert.equal(Object.keys(R2_SEALED_PENDING).length,2);
 assert.equal(R2_RESERVED_ITEM_IDS.length,4);
 for(const[itemId,modelId,sku,productId,reason]of PAIRS){
  const item={itemId,modelId,modelSku:sku,quantity:1};
  assert.equal(R2_SEALED_PENDING[itemId+'|'+modelId].productId,productId);
  assert.equal(R2_SEALED_PENDING[itemId+'|'+modelId].gramsPerSealedPackage,1000);
  assert.equal(r2SealedPackageBlocker(item,{channelAccountId:R2_ADAO_ACCOUNT_ID}),reason);
  assert.equal(r2SealedPackageBlocker(item,{channelAccountId:'wrong'}),'r2_channel_account_unverified');
  assert.equal(r2RequiresOfficialIdentity(item,{channelAccountId:R2_ADAO_ACCOUNT_ID}),true);
  assert.equal(r2RequiresOfficialIdentity(item,{channelAccountId:'wrong'}),false);
 }
});
test('canonical 1kg mapping can preview an order without asserting any sealed physical stock',()=>{
 for(const[itemId,modelId,sku,productId,reason]of PAIRS)for(const q of [1,2,5]){
  const component={product_id:productId,variant_id:null,physical_multiplier:1000,physical_identity:{active:true,unit:'g',presentation_factors:[1000]}};
  const item={itemId,modelId,modelSku:sku,itemName:'Pacote original fechado 1kg',modelName:'1 kg',quantity:q};
  assert.equal(mappingPhysicalBlocker(item,{...component,components:[component]},{channelAccountId:R2_ADAO_ACCOUNT_ID}),null);
  const mapping={id:'R2-FAKE-'+modelId,marketplace:'shopee',marketplace_account:'SHOPEE ADÃO',channel_account_id:R2_ADAO_ACCOUNT_ID,
   external_item_id:itemId,external_model_id:modelId,external_item_key:'official:item:'+itemId+'|model:'+modelId,...component};
  const preview=fixture(item,[mapping]);
  assert.equal(preview.orders[0].items[0].mappingStatus,'recognized');
  assert.equal(preview.operationalWrites,false);
  assert.equal(preview.orders[0].recognizedItems,1);
 }
});
test('unmapped official pair, unknown model, banned old acid items and legacy title/SKU aliases fail closed',()=>{
 for(const[itemId,modelId,sku]of PAIRS){
  const item={itemId,modelId,modelSku:sku,itemName:'Pacote 1 kg',modelName:'1kg',quantity:1};
  assert.equal(fixture(item).orders[0].items[0].mappingStatus,'needs_mapping');
  assert.equal(fixture({...item,modelId:'unpublished-model'}).orders[0].items[0].mappingStatus,'needs_mapping');
  const legacy={id:'R2-LEGACY',marketplace:'shopee',marketplace_account:'SHOPEE ADÃO',channel_account_id:R2_ADAO_ACCOUNT_ID,external_item_key:'sku:'+sku.toLowerCase()+'|variation:1kg',product_id:PAIRS[0][3],physical_multiplier:1000};
  assert.equal(fixture(item,[legacy]).orders[0].items[0].mappingStatus,'needs_mapping');
 }
 for(const itemId of ['58211483673','58261478969']){
  const item={itemId,modelId:'historical',itemName:'Acido Citrico',modelName:'1kg',quantity:1};
  assert.equal(r2RequiresOfficialIdentity(item,{channelAccountId:R2_ADAO_ACCOUNT_ID}),true);
  assert.equal(fixture(item).orders[0].items[0].mappingStatus,'needs_mapping');
 }
});
test('no unrelated account/product intercepted',()=>{
 const item={itemId:'other',modelId:'other',quantity:1};
 assert.equal(r2SealedPackageBlocker(item,{channelAccountId:R2_ADAO_ACCOUNT_ID}),null);
 assert.equal(r2RequiresOfficialIdentity(item,{channelAccountId:R2_ADAO_ACCOUNT_ID}),false);
});
