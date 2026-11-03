import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DU_PORTO_ADAO_V12_MODELS, DU_PORTO_ADAO_ACCOUNT_ID,
  DU_PORTO_PRODUCT_ID, DU_PORTO_FLAVOR_VARIANTS,
} from '../src/shopee-po-sorvete-adao-v12-contract.mjs';
import { duPortoPhysicalBlocker } from '../src/shopee-po-sorvete-adao-v12-guard.mjs';

const cases=Object.entries(DU_PORTO_ADAO_V12_MODELS);
const scope={channelAccountId:DU_PORTO_ADAO_ACCOUNT_ID};
function sample(key, packs, q=1) {
  const [itemId,modelId]=key.split('|');
  return {
    item:{itemId,modelId,quantity:q,itemName:'Pó para Sorvete Du Porto',modelName:'Nome comercial'},
    components:packs.flatMap((packsOfFlavor,index)=>packsOfFlavor
      ? [{product_id:DU_PORTO_PRODUCT_ID,variant_id:DU_PORTO_FLAVOR_VARIANTS[index],
          physical_multiplier:packsOfFlavor*1000,
          physical_identity:{active:true,unit:'g',presentation_factors:[1000]}}]
      : []),
  };
}
test('V12 contains 161 unique official Model identities split 77/77/7',()=>{
  assert.equal(cases.length,161);
  const counts={};
  for (const [key] of cases) {
    const [item]=key.split('|');
    counts[item]=(counts[item]??0)+1;
  }
  assert.deepEqual(counts,{'23994536652':77,'58222180448':77,'58222164108':7});
  assert.equal(new Set(cases.map(([key])=>key)).size,161);
});
test('all 161 physical configurations and Q=1,2,5 follow the sealed 1kg contract',()=>{
  let componentCount=0;
  for(const [key,packs] of cases){
    const modelPacks=packs.reduce((sum,n)=>sum+n,0);
    const [itemId]=key.split('|');
    assert.ok(itemId==='23994536652'?[1,2,3].includes(modelPacks)
      :itemId==='58222180448'?[5,10,15].includes(modelPacks):modelPacks===25,key);
    componentCount+=packs.filter(Boolean).length;
    for(const q of [1,2,5]){
      const {item,components}=sample(key,packs,q);
      assert.equal(duPortoPhysicalBlocker(item,components,scope,packs),null,key);
      assert.equal(components.reduce((sum,c)=>sum+c.physical_multiplier,0)*q,modelPacks*1000*q,key);
    }
  }
  assert.equal(componentCount,343);
});
test('composition mutations never pass silently: wrong flavor/factor, missing or duplicated component',()=>{
  for(const [key,packs] of cases){
    const {item,components}=sample(key,packs);
    let mutated=components.map(c=>({...c}));
    mutated[0].physical_multiplier+=1000;
    assert.equal(duPortoPhysicalBlocker(item,mutated,scope,packs),'du_porto_physical_identity_unverified',key);
    mutated=components.map(c=>({...c}));
    mutated[0].variant_id='wrong';
    assert.equal(duPortoPhysicalBlocker(item,mutated,scope,packs),'du_porto_physical_identity_unverified',key);
    mutated=components.slice(1);
    assert.equal(duPortoPhysicalBlocker(item,mutated,scope,packs),'du_porto_composition_invalid',key);
    mutated=components.concat(components[0]);
    assert.equal(duPortoPhysicalBlocker(item,mutated,scope,packs),'du_porto_composition_invalid',key);
    assert.equal(duPortoPhysicalBlocker(item,components,{channelAccountId:'foreign'},packs),
      'du_porto_account_unverified',key);
  }
});
test('invalid Q and missing physical 1kg presentation are blocked',()=>{
  const [key,packs]=cases[0];
  for(const q of [0,-1,1.5,Number.MAX_SAFE_INTEGER]){
    const {item,components}=sample(key,packs,q);
    assert.equal(duPortoPhysicalBlocker(item,components,scope,packs),'physical_quantity_invalid');
  }
  const {item,components}=sample(key,packs);
  components[0].physical_identity.presentation_factors=[500];
  assert.equal(duPortoPhysicalBlocker(item,components,scope,packs),
    'du_porto_physical_identity_unverified');
});
