import { readLiveShopeeOrderIntakeBatch } from './core-bridge.mjs';
import { buildShopeeMappingPreview } from './shopee-mapping-preview.mjs';
import { expectedTrufasComponents } from './shopee-trufas-physical-reconciliation.mjs';
import { SHOPEE_TRUFAS_ADAO_REFERENCE_20261029 } from './shopee-trufas-adao-reference-20261029.mjs';
import { shopeeTrufa30TemporalBlocker } from './shopee-trufa30-temporal-guard.mjs';
import { shopeeTrufa40HistoricalBlocker } from './shopee-trufa40-historical-guard.mjs';
import { shopeePortoGelLegacyBlocker } from './shopee-porto-gel-legacy-guard.mjs';

const ACCOUNT = 'b4027369-5abf-4ac1-ab24-862334fae892';
const GLU = '788f7d5a-276c-49c8-8171-cccf7621e2fe';
const PG = '6e757550-a9b6-4644-8164-8c802760e373';
const component = (product_id, variant_id, physical_multiplier) => ({ product_id, variant_id, physical_multiplier });
const OFFERS = Object.freeze([
  ['GLUCOSE','20299904028','228793331644', [component(GLU,'13ec7121-e3dd-4c4a-84e6-a186d9236647',1)]],
  ['GLUCOSE','20299904028','228793331645', [component(GLU,'ded86020-55b5-4899-a263-1d0dea6b9c88',1)]],
  ['GLUCOSE','22899050851','189180993076',[component(GLU,'f6783627-bfb6-438e-8663-b37f20697697',1)]],
  ['GLUCOSE','22899050851','189180993077',[component(GLU,'beb66a4e-ce39-4c8b-b85c-22308f8dc6d2',1)]],
  ['GLUCOSE','22899050851','189180993078',[component(GLU,'21c194d0-b9af-4d70-b1a0-0d101a4aafbc',1)]],
  ['PORTO_GEL','58211561353','199622481699',[component(PG,'ae7c8013-de6c-4806-9450-abcab2202aa9',1)]],
  ['PORTO_GEL','58211561353','199622481700',[component(PG,'ae7c8013-de6c-4806-9450-abcab2202aa9',2)]],
  ['PORTO_GEL','58211561353','199622481701',[component(PG,'5d4602ba-0db4-4095-8866-6e702fa192c5',1)]],
  ['PORTO_GEL','58211561353','199622481702',[component(PG,'5d4602ba-0db4-4095-8866-6e702fa192c5',1),component(PG,'ae7c8013-de6c-4806-9450-abcab2202aa9',1)]],
  ['PORTO_GEL','58211569433','199190017655',[component(PG,'9173505d-7720-40b6-8040-84d68a3c2334',1)]],
]);
const EXPECTED = Object.freeze([
  ...expectedTrufasComponents(SHOPEE_TRUFAS_ADAO_REFERENCE_20261029).map(x => ({
    family: x.family, item_id: x.item_id, model_id: x.model_id, components: x.components,
  })),
  ...OFFERS.map(([family,item_id,model_id,components]) => ({ family,item_id,model_id,components })),
]);
function fingerprint(c) { return String(c.product_id)+'|'+String(c.variant_id)+'|'+Number(c.physical_multiplier); }
function matchComponents(actual, expected) {
  const a = actual.map(c => fingerprint({product_id:c.productId,variant_id:c.variantId,physical_multiplier:c.physicalQuantity})).sort();
  const e = expected.map(fingerprint).sort();
  return a.length===e.length && a.every((x,i) => x===e[i]);
}
const snapshot = (item_id,model_id) => ({
  channelAccountId:ACCOUNT,
  orders:[{items:[{itemId:item_id,modelId:model_id}]}],
});
const GUARDS = [shopeeTrufa30TemporalBlocker,shopeeTrufa40HistoricalBlocker,shopeePortoGelLegacyBlocker];

export async function previewAdaoMappings70({ readBatch = readLiveShopeeOrderIntakeBatch } = {}) {
  const batch = await readBatch({channel_account_id:ACCOUNT,limit:1});
  if (!batch?.ok || !Array.isArray(batch.payload?.mappings) || batch.payload.marketplace_account!=='SHOPEE ADÃO') {
    return {ok:false,code:'mapping_catalog_unavailable',selected:0,recognized:0,components_verified:0,written:0};
  }
  const order={orderSn:'mapping-diagnostic-no-order',externalStatus:'DIAGNOSTIC_ONLY',items:EXPECTED.map(r=>({
    itemId:r.item_id,modelId:r.model_id,itemName:r.family,modelName:'DIAGNOSTIC_ONLY',
    itemSku:null,modelSku:null,quantity:1,
  }))};
  const normalized={source:'shopee_open_platform',environment:'live',channelAccountId:ACCOUNT,orders:[order]};
  const preview=buildShopeeMappingPreview(normalized,batch.payload.mappings,{
    channelAccountId:ACCOUNT,marketplaceAccount:'SHOPEE ADÃO',requirePhysicalValidation:true,
  });
  const items=preview.orders?.[0]?.items??[];
  const detail=EXPECTED.map((r,i)=>{
    const x=items[i],matched=x?.mappingStatus==='recognized'&&matchComponents(x.components??[],r.components);
    return {family:r.family,item_id:r.item_id,model_id:r.model_id,
      mapping_status:x?.mappingStatus??'missing',components_match:matched,
      verified_components:matched?r.components.length:0};
  });
  const quarantine=[
    ['T30','22898142109','229425631222',shopeeTrufa30TemporalBlocker],
    ['T30','22898142109','229425631223',shopeeTrufa30TemporalBlocker],
    ['T30','22898142109','229425631224',shopeeTrufa30TemporalBlocker],
    ['T30','22898142109','229425631225',shopeeTrufa30TemporalBlocker],
    ['T30','22898142109','229425631226',shopeeTrufa30TemporalBlocker],
    ...Object.entries({'19598189256':['159546591760'],'21999552311':['238789009560','238789009561','238789009562'],'22193668881':['238778628464'],'22393654582':['109869648890','109869648891']}).flatMap(([item,models])=>models.map(model=>['T40',item,model,shopeeTrufa40HistoricalBlocker])),
    ['PORTO_GEL','58211561353','199622481703',shopeePortoGelLegacyBlocker],
  ].map(([family,item,model,guard])=>({family,item_id:item,model_id:model,blocked:typeof guard(snapshot(item,model))==='string'}));
  const otherAccount={...snapshot('58211561353','199622481703'),channelAccountId:'00000000-0000-4000-8000-000000000000'};
  const accountIsolation=GUARDS.every(guard=>guard(otherAccount)===null);
  const families=Object.fromEntries(['T30','T40','GLUCOSE','PORTO_GEL'].map(family=>{
    const matches=detail.filter(x=>x.family===family);
    return [family,{expected:matches.length,recognized:matches.filter(x=>x.components_match).length,
      components_verified:matches.reduce((a,x)=>a+x.verified_components,0)}];
  }));
  const recognized=detail.filter(x=>x.components_match).length;
  const componentsVerified=detail.reduce((a,x)=>a+x.verified_components,0);
  const ok=detail.length===70&&recognized===70&&componentsVerified===131&&quarantine.every(x=>x.blocked)&&accountIsolation;
  return {ok,code:ok?'ok':'mapping_diagnostic_mismatch',mode:'read_only_mapping_diagnostic',
    selected:detail.length,recognized,components_verified:componentsVerified,blocked:detail.length-recognized,
    written:0,account_isolation:accountIsolation,historical_quarantine:quarantine,
    families,items:detail};
}
