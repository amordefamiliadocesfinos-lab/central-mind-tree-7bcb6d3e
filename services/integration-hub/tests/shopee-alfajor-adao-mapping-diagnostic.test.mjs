import test from 'node:test';
import assert from 'node:assert/strict';
import { previewAlfajorAdaoMappings, ALFAJOR_ADAO_ACCOUNT } from '../src/shopee-alfajor-adao-mapping-diagnostic.mjs';

const P='62cf9f63-be04-4261-ad11-569028dd1125';
const W='d89e1dba-ca80-4136-b9f3-225fb80b6dfb';
const D='e4d756c8-f324-4ac0-b9ff-6adae24f5310';
const variants=[
  ['21698187551','139659739038',6,0],['21698187551','139659739039',0,6],['21698187551','139659739040',3,3],
  ['18599184676','229452998566',18,0],['18599184676','229452998567',0,18],['18599184676','229452998568',9,9],
  ['22398139644','159796178241',36,0],['22398139644','159796178238',0,36],['22398139644','159796178244',18,18],
  ['22398139644','159796178242',72,0],['22398139644','159796178245',0,72],['22398139644','159796178243',36,36],
  ['22398139644','159796178246',108,0],['22398139644','159796178239',0,108],['22398139644','159796178247',54,54],
  ['22398139644','159796178248',144,0],['22398139644','159796178249',0,144],['22398139644','159796178240',72,72],
  ['22997344559','209628761598',504,0],['22997344559','209628761599',0,504],['22997344559','209628761597',252,252],
];
const mappings=variants.map(([itemId,modelId,white,dark])=>({
  id:modelId,marketplace:'shopee',channel_account_id:ALFAJOR_ADAO_ACCOUNT,
  external_item_id:itemId,external_model_id:modelId,
  components:[[W,white],[D,dark]].filter(([,qty])=>qty>0).map(([variant_id,physical_multiplier],position)=>({
    product_id:P,variant_id,physical_multiplier,position,physical_identity:{active:true,unit:'un'}
  })),
}));
test('diagnostic recognizes all 21 persisted official IDs and correct physical breakdown without writes',async()=>{
  let reads=0;
  const result=await previewAlfajorAdaoMappings({readBatch:async(request)=>{
    reads++;
    assert.deepEqual(request,{channel_account_id:ALFAJOR_ADAO_ACCOUNT,limit:1});
    return {ok:true,payload:{marketplace_account:'SHOPEE ADÃO',mappings}};
  }});
  assert.equal(reads,1);
  assert.equal(result.ok,true);
  assert.deepEqual([result.selected,result.recognized,result.blocked,result.written],[21,21,0,0]);
  assert.deepEqual(result.negative_tests,{unknown_model:true,wrong_account:true});
  assert.equal(result.items.every(i=>i.mapping_status==='recognized' && i.components_match),true);
});
test('diagnostic rejects unavailable or wrong-account catalog',async()=>{
  for(const batch of [{ok:false},{ok:true,payload:{marketplace_account:'SHOPEE OUTRA',mappings}}]){
    const result=await previewAlfajorAdaoMappings({readBatch:async()=>batch});
    assert.deepEqual(result,{ok:false,code:'mapping_catalog_unavailable',written:0});
  }
});
test('diagnostic fails closed on changed physical composition',async()=>{
  const broken=mappings.map(m=>({...m,components:m.components.map(c=>({...c}))}));
  broken[2].components[0].physical_multiplier=2;
  const result=await previewAlfajorAdaoMappings({readBatch:async()=>({
    ok:true,payload:{marketplace_account:'SHOPEE ADÃO',mappings:broken}
  })});
  assert.equal(result.ok,false);
  assert.deepEqual([result.selected,result.recognized,result.blocked,result.written],[21,20,1,0]);
});
