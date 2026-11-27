import test from 'node:test';
import assert from 'node:assert/strict';
import {verifyCycleExistingOrder} from '../../../supabase/functions/integration-core-bridge/cycle.mjs';

const A='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', I='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const SN='SYNTHETIC001';
const order={id:I,channel_account_id:A,channel:'shopee',order_number:SN,
 sale_origin:'shopee_open_platform',deleted_at:null,status:'pendente',operational_status:'todo',total_value:20};
const payload={channel_account_id:A,order_number:SN,total_value:20,items:[
 {product_id:'p1',variant_id:'v1',quantity:4,commercial_quantity:2,unit_price:10}]};
const items=[{product_id:'p1',variant_id:'v1',quantity:4,unit_price:5}];
function fixture({rows=[order],current=order,lines=items,error=null}={}){
 const calls=[];
 return {calls,from(table){
   calls.push(['from',table]);
   assert.ok(['orders','order_items'].includes(table));
   const q={select(fields){calls.push(['select',fields]);return q},
     eq(k,v){calls.push(['eq',k,v]);return q},
     limit(n){assert.equal(n,2);return Promise.resolve({data:rows,error})},
     maybeSingle(){return Promise.resolve({data:current,error})},
     then(resolve){return Promise.resolve({data:lines,error}).then(resolve)}};
   return q;
 }};
}
test('D11 verifies an existing open canonical order and exact physical composition and value by reads only',async()=>{
 const core=fixture();
 assert.deepEqual(await verifyCycleExistingOrder(core,payload),{ok:true,status:'verified_existing',channel_account_id:A,order_number:SN,order_id:I});
 assert.deepEqual(core.calls.filter(c=>c[0]==='from').map(c=>c[1]),['orders','orders','order_items']);
});
test('D11 refuses missing, duplicate, tombstoned, closed or mismatched canonical orders before composition',async()=>{
 for(const rows of [[],[order,{...order,deleted_at:'2026-11-27'}],
   [{...order,deleted_at:'2026-11-27'}],[{...order,status:'cancelado'}],[{...order,operational_status:'shipped'}],
   [{...order,channel_account_id:I}],[{...order,sale_origin:'manual'}],[{...order,total_value:21}]]){
  const core=fixture({rows});
  assert.equal((await verifyCycleExistingOrder(core,payload)).ok,false);
  assert.equal(core.calls.filter(c=>c[0]==='from').length,1);
 }
});
test('D11 refuses composition drift, changed price, changed variant or read error',async()=>{
 for(const lines of [[],[{...items[0],quantity:5}],[{...items[0],unit_price:6}],[{...items[0],variant_id:'v2'}]]){
   assert.equal((await verifyCycleExistingOrder(fixture({lines}),payload)).ok,false);
 }
 assert.equal((await verifyCycleExistingOrder(fixture({error:'unavailable'}),payload)).ok,false);
 assert.equal((await verifyCycleExistingOrder(fixture({current:{...order,deleted_at:'2026-11-27'}}),payload)).ok,false);
});
