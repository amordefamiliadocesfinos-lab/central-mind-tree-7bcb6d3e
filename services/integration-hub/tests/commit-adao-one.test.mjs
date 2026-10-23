import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { CORE_BRIDGE_URL } from '../src/core-bridge.mjs';
import { PILOT, commitAdaoOne } from '../src/commit-adao-one.mjs';

const ENV = { CORE_BRIDGE_HMAC_SECRET: 'fixture-secret-do-not-log' };
const ORDER_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const SEP_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const order = (overrides={}) => ({
  order_sn: PILOT.order, order_status: 'PROCESSED', create_time: 1792788500,
  total_amount: 52.62, payment_method: 'Pix', recipient_address: {
    name: 'PRIVATE CUSTOMER', phone: 'PRIVATE PHONE',
  },
  item_list: [{ item_id: PILOT.item, model_id: 0,
    item_name: 'Alfajor Doce de Leite 60g Caixa 18 Amor de Família SH-001-014',
    model_name: '', item_sku: '', model_sku: '', model_quantity_purchased: 1,
    model_original_price: 53, model_discounted_price: 53 }],
  ...overrides,
});
const component = (variant_id,position,qty=9) => ({
  product_id: PILOT.product, variant_id, physical_multiplier: qty,
  position, physical_identity: {
    active:true, unit:'un',presentation_factors:[6,18,36],
  },
});
const mapping = (overrides={}) => ({
  id: PILOT.mapping, marketplace:'shopee', marketplace_account:PILOT.shopName,
  channel_account_id:PILOT.account, external_item_key:PILOT.key,
  product_id:PILOT.product, variant_id:PILOT.variants[0],
  physical_multiplier:9,
  components:PILOT.variants.map((v,i)=>component(v,i)),
  ...overrides,
});
const raw = (item=order())=>({
  source:'shopee_open_platform', environment:'live',
  channel_account_id:PILOT.account, external_entity_type:'order',
  external_entity_id:PILOT.order, endpoint:'/api/v2/order/get_order_detail',
  observed_at:'2026-10-23T21:34:13Z',
  payload:{response:{order_list:[item]}},
});
const batch=(options={})=>({
  status:'ok',action:'shopee.order_intake_batch.read',
  channel_account_id:PILOT.account,marketplace_account:PILOT.shopName,
  eligible_statuses:['PROCESSED','READY_TO_SHIP'], snapshots:[raw()],
  mappings:[mapping()], counts:{selected:1,skipped_existing:0,skipped_status:0,
    skipped_malformed:0},...options,
});
function fixture({ data=batch(), already=false, lost=false }={}) {
  const calls=[];
  const fetchImpl=async (url,init)=>{
    assert.equal(new URL(url).href,CORE_BRIDGE_URL);
    assert.equal(init.method,'POST');
    assert.equal(init.redirect,'error');
    const req=JSON.parse(init.body);
    calls.push(req);
    const common={request_id:init.headers['X-Integration-Hub-Request-Id']};
    if(req.action==='shopee.order_intake_batch.read') {
      assert.deepEqual(req,{action:'shopee.order_intake_batch.read',
        channel_account_id:PILOT.account,limit:1,order_sn:PILOT.order});
      return new Response(JSON.stringify({...data,...common}),{status:200,headers:{'content-type':'application/json'}});
    }
    assert.equal(req.action,'shopee.order.create');
    assert.equal(req.channel_account_id,PILOT.account);
    assert.equal(req.order_number,PILOT.order);
    assert.equal(req.verify_existing,true);
    assert.equal(req.items.length,2);
    assert.deepEqual(req.items.map(x=>x.quantity),[9,9]);
    assert.deepEqual(req.items.map(x=>x.variant_id),PILOT.variants);
    if(lost) throw new Error('PRIVATE NETWORK CUSTOMER TOKEN');
    return new Response(JSON.stringify({...common,order_id:ORDER_ID,
      separation_id:SEP_ID,already_registered:already}),{status:200,headers:{'content-type':'application/json'}});
  };
  return {calls,fetchImpl};
}

test('F6-Q.6C confirmation is mandatory and missing secret fails before network',async()=>{
  let calls=0;const fetchImpl=async()=>{calls++;throw new Error('forbidden')};
  assert.equal((await commitAdaoOne({env:ENV,fetchImpl})).code,'confirmation_required');
  assert.equal((await commitAdaoOne({confirmed:true,env:{},fetchImpl})).code,'configuration_missing');
  assert.equal(calls,0);
});

test('F6-Q.6C one exact 18-unit alfajor order: 1 read then 1 verified create',async()=>{
  const f=fixture();
  const result=await commitAdaoOne({confirmed:true,env:ENV,fetchImpl:f.fetchImpl});
  assert.deepEqual(result,{ok:true,code:'written',account_id:PILOT.account,
    order_sn:PILOT.order,attempted:1,written:1,
    order_id:ORDER_ID,separation_id:SEP_ID});
  assert.deepEqual(f.calls.map(x=>x.action),['shopee.order_intake_batch.read','shopee.order.create']);
  const serialized=JSON.stringify(result);
  for(const value of ['PRIVATE','fixture-secret','access_token','recipient_address','53']) {
    assert.equal(serialized.includes(value),false);
  }
});

test('F6-Q.6C duplicate is idempotent and not counted as a new order',async()=>{
  const f=fixture({already:true});
  const result=await commitAdaoOne({confirmed:true,env:ENV,fetchImpl:f.fetchImpl});
  assert.equal(result.code,'already_registered');
  assert.equal(result.written,0);
  assert.equal(f.calls.length,2);
});

test('F6-Q.6C unexpected mapping blocks write',async()=>{
  const f=fixture({data:batch({mappings:[]})});
  const result=await commitAdaoOne({confirmed:true,env:ENV,fetchImpl:f.fetchImpl});
  assert.equal(result.ok,false);
  assert.equal(result.written,0);
  assert.equal(f.calls.length,1);
});

test('F6-Q.6C wrong physical split cannot reach writer',async()=>{
  const altered=mapping({components:[
    component(PILOT.variants[0],0,10),component(PILOT.variants[1],1,8),
  ]});
  const f=fixture({data:batch({mappings:[altered]})});
  const result=await commitAdaoOne({confirmed:true,env:ENV,fetchImpl:f.fetchImpl});
  assert.equal(result.ok,false);
  assert.equal(result.written,0);
  assert.equal(f.calls.length,1);
});

test('F6-Q.6C wrong source order status blocks writing',async()=>{
  const f=fixture({data:batch({snapshots:[raw(order({order_status:'CANCELLED'}))]})});
  const result=await commitAdaoOne({confirmed:true,env:ENV,fetchImpl:f.fetchImpl});
  assert.equal(result.ok,false);
  assert.equal(f.calls.length,1);
});

test('F6-Q.6C uncertainty never causes an automatic retry',async()=>{
  const f=fixture({lost:true});
  const result=await commitAdaoOne({confirmed:true,env:ENV,fetchImpl:f.fetchImpl});
  assert.equal(result.ok,false);
  assert.equal(result.written,0);
  assert.equal(result.attempted,1);
  assert.equal(f.calls.length,2);
  assert.equal(JSON.stringify(result).includes('PRIVATE'),false);
});

test('F6-Q.6C rejects wrong account in Core response',async()=>{
  const f=fixture({data:batch({marketplace_account:'SHOPEE VIVIANE'})});
  const result=await commitAdaoOne({confirmed:true,env:ENV,fetchImpl:f.fetchImpl});
  assert.equal(result.ok,false);
  assert.equal(f.calls.length,1);
});

test('F6-Q.6C CLI refuses missing or wrong exact confirmation',()=>{
  const script=fileURLToPath(new URL('../src/commit-adao-one.mjs',import.meta.url));
  for(const args of [[],['--commit-one'],['--commit-one','--confirm=WRONG'],
    ['--preview-adao'],['--commit-one','--confirm=COMMIT_ADAO_261023DJN3D920']]){
    const p=spawnSync(process.execPath,[script,...args],{encoding:'utf8',env:{}});
    assert.equal(p.status,2);
    assert.equal(p.stderr,'');
  }
});
