import test from 'node:test';
import assert from 'node:assert/strict';
import { isTrufaSealedP100, sumTrufaSealedStock, TRUFA_PACK_MASTER_ID } from './trufaSealedP100';
import type { CommercialPresentation } from '../products/commercialPresentation';

const brigadeiro='1af56d5f-476a-4645-9182-b420cac5c190';
const make=(patch: Partial<CommercialPresentation>={}):CommercialPresentation=>({
  id:'ea58ce04-2bfc-4399-a00e-8cb8f7e584ce',
  product_id:TRUFA_PACK_MASTER_ID, variant_id:brigadeiro,
  name:'Pacote 100 un', commercial_unit_label:'pacote',
  conversion_factor:100, composition_mode:'single', is_active:true,
  notes:null, created_at:'',updated_at:'',...patch,
});
test('ET1: P100 apenas apresentação canônica de um único sabor',()=>{
  assert.equal(isTrufaSealedP100(TRUFA_PACK_MASTER_ID,brigadeiro,make()),true);
  assert.equal(isTrufaSealedP100('outro',brigadeiro,make()),false);
  assert.equal(isTrufaSealedP100(TRUFA_PACK_MASTER_ID,'outro',make()),false);
  assert.equal(isTrufaSealedP100(TRUFA_PACK_MASTER_ID,null,make()),false);
  assert.equal(isTrufaSealedP100(TRUFA_PACK_MASTER_ID,brigadeiro,make({is_active:false})),false);
  assert.equal(isTrufaSealedP100(TRUFA_PACK_MASTER_ID,brigadeiro,make({composition_mode:'composite'})),false);
  assert.equal(isTrufaSealedP100(TRUFA_PACK_MASTER_ID,brigadeiro,make({conversion_factor:1})),false);
  assert.equal(isTrufaSealedP100(TRUFA_PACK_MASTER_ID,brigadeiro,null),false);
});
test('ET1: estoque lacrado agregado por sabor nunca usa EA',()=>{
  assert.deepEqual(sumTrufaSealedStock([
    {variant_id:brigadeiro,packs:2},{variant_id:brigadeiro,packs:'3'},
    {variant_id:'morango',packs:1},{variant_id:'morango',packs:-2},
  ]),{[brigadeiro]:5,morango:1});
  assert.deepEqual(sumTrufaSealedStock([]),{});
});
