import test from 'node:test';
import assert from 'node:assert/strict';
import { presentShopeeLogistics } from '../../../src/lib/orders/shopeeLogisticsPresentation.mjs';

const account = 'b4027369-5abf-4ac1-ab24-862334fae892';
const sn = '261027N7HVNRKQ';
const selection = state => ({ ok:true, account:'adao', selected:[{
  order_sn:sn,state,reason:'test',
  auto_arrangement_authorized:false,
  create_shipping_document_authorized:false,
  inventory_mutation_authorized:false
}]});
test('presents read-only logistics states without action permissions', () => {
  for (const state of ['AGUARDANDO_ORGANIZACAO','ENVIO_JA_ORGANIZADO','EXPEDIDO','BLOQUEADO','INDETERMINADO']) {
    const result = presentShopeeLogistics(selection(state),sn,account);
    assert.ok(result?.label);
    assert.equal(result.canArrange,false);
    assert.equal(result.canCreateDocument,false);
    assert.equal(result.canMutateInventory,false);
  }
});
test('requires correct account, unique order and explicit safety flags',()=>{
  assert.equal(presentShopeeLogistics(selection('ENVIO_JA_ORGANIZADO'),sn,'wrong'),null);
  assert.equal(presentShopeeLogistics(selection('ENVIO_JA_ORGANIZADO'),'261023C0CDYM5H',account),null);
  assert.equal(presentShopeeLogistics({...selection('EXPEDIDO'),selected:[]},sn,account),null);
  assert.equal(presentShopeeLogistics({...selection('EXPEDIDO'),selected:[...selection('EXPEDIDO').selected,...selection('EXPEDIDO').selected]},sn,account),null);
  const unsafe=selection('EXPEDIDO');unsafe.selected[0].inventory_mutation_authorized=true;
  assert.equal(presentShopeeLogistics(unsafe,sn,account),null);
});
