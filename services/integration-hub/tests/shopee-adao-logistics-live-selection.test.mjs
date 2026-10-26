import test from 'node:test';
import assert from 'node:assert/strict';
import { selectAdaoLiveWithCore } from '../src/shopee-adao-logistics-live-selection.mjs';

const active='261027ABCDEF12';
const deleted='261023C0CDYM5H';

test('consults canonical tombstones before external details and skips deleted order', async () => {
  const calls=[];
  const result=await selectAdaoLiveWithCore({
    orderSns:[active,deleted],
    readTombstones: async input=>{
      calls.push('core');
      assert.deepEqual(input.order_sns,[active,deleted]);
      return {ok:true,payload:{status:'ok',deleted_order_sns:[deleted]}};
    },
    readDetails:async input=>{
      calls.push('details');
      assert.deepEqual(input.order_sns,[active]);
      return {ok:true,orders:[{order_sn:active,order_status:'READY_TO_SHIP',
        package_list:[{package_number:'PKG123',logistics_status:'LOGISTICS_READY'}]}]};
    },
  });
  assert.equal(result.ok,true);
  assert.deepEqual(calls,['core','details']);
  assert.equal(result.selected.find(o=>o.order_sn===deleted).state,'BLOQUEADO');
  assert.equal(result.selected.find(o=>o.order_sn===active).state,'AGUARDANDO_ORGANIZACAO');
});

test('unavailable Core fails closed without calling Shopee', async () => {
  let external=0;
  const result=await selectAdaoLiveWithCore({
    orderSns:[active],
    readTombstones:async()=>({ok:false}),
    readDetails:async()=>{external++; return {ok:true,orders:[]}},
  });
  assert.equal(result.ok,false);
  assert.equal(result.code,'tombstone_lookup_unavailable');
  assert.equal(external,0);
});

test('incomplete external details fail closed', async () => {
  const r=await selectAdaoLiveWithCore({
    orderSns:[active],
    readTombstones:async()=>({ok:true,payload:{status:'ok',deleted_order_sns:[]}}),
    readDetails:async()=>({ok:true,orders:[]}),
  });
  assert.equal(r.code,'order_detail_unavailable');
});
