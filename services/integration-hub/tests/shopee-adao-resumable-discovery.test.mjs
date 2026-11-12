import test from 'node:test';
import assert from 'node:assert/strict';
import { createAdaoResumableDiscovery, F12_3_SCOPE } from '../src/shopee-adao-resumable-discovery.mjs';

const clock = () => Date.parse('2026-11-12T18:00:00Z');
const synthetic = () => Array.from({ length: 100 }, (_, i) =>
  '261112' + String(i).padStart(8, '0'));

test('F12.3: 100 synthetic orders are discovered across 5 bounded slices with exact frozen window', async () => {
  const all = synthetic();
  const calls = [];
  const reader = async arg => {
    calls.push(arg);
    const index = arg.cursor === null ? 0 : Number(arg.cursor.slice(1));
    const order_sns = all.slice(index * 10, index * 10 + 10);
    const more = index < 9;
    return { ok: true, shop_id: F12_3_SCOPE.shop, order_sns, more,
      next_cursor: more ? 'p' + (index + 1) : null };
  };
  const readSlice = createAdaoResumableDiscovery({ readOrders: reader, now: clock });
  let checkpoint = null;
  const gathered = [];
  let rounds = 0, result;
  do {
    result = await readSlice(checkpoint);
    assert.equal(result.ok, true);
    gathered.push(...result.page_orders.flat());
    checkpoint = result.checkpoint;
    rounds++;
    assert.ok(result.pages_in_slice <= 2);
  } while (!result.completed && rounds < 7);
  assert.equal(result.completed, true);
  assert.equal(rounds, 5);
  assert.equal(calls.length, 10);
  assert.equal(result.total_pages, 10);
  assert.equal(result.total_orders, 100);
  assert.deepEqual(gathered, all);
  assert.ok(calls.every(c => c.timeFrom === calls[0].timeFrom
    && c.timeTo === calls[0].timeTo && c.pageSize === 10
    && c.onlyIntakeEligibleOrders === true));
});

test('F12.3: early completion finishes cleanly, without phantom pages', async () => {
  const r = await createAdaoResumableDiscovery({
    now: clock, readOrders: async () => ({ ok:true, shop_id:F12_3_SCOPE.shop,
      order_sns:['26111200000001'], more:false }),
  })();
  assert.equal(r.code,'discovery_complete');
  assert.equal(r.total_pages,1);
  assert.equal(r.total_orders,1);
  assert.equal(r.checkpoint,null);
});

test('F12.3: rejects foreign/tampered checkpoints before reading Shopee', async () => {
  let calls=0;
  const runner=createAdaoResumableDiscovery({ now:clock,readOrders:async ()=>{
    calls++; throw new Error('should never reach');
  }});
  const good={version:1, account:F12_3_SCOPE.account, shop:F12_3_SCOPE.shop,
    timeFrom:1794482370-172800,timeTo:1794482370,cursor:'p1',
    pages:1,orders:10,visited:['p1']};
  for (const bad of [
    {...good,account:'other'},
    {...good,shop:1},
    {...good,pages:11},
    {...good,cursor:'p2'},
    {...good,visited:['p1','p1'],pages:2},
    {...good,orders:101},
    {...good,unexpected:'data'},
  ]) {
    assert.equal((await runner(bad)).code,'invalid_checkpoint');
  }
  assert.equal(calls,0);
});

test('F12.3: invalid/repeated pagination fails closed, never reports complete', async () => {
  const readSlice=createAdaoResumableDiscovery({
    now:clock,readOrders:async ()=>({ok:true,shop_id:F12_3_SCOPE.shop,
      order_sns:[],more:true,next_cursor:'p1'}),
  });
  const first=await readSlice();
  assert.equal(first.ok,false);
  assert.equal(first.code,'invalid_cursor');
  assert.equal(first.checkpoint,null);
});

test('F12.3: reader exceptions, wrong shop and invalid order IDs stop without writes', async () => {
  for (const reader of [
    async ()=>{throw Error('private API details');},
    async ()=>({ok:true,shop_id:999,order_sns:[],more:false}),
    async ()=>({ok:true,shop_id:F12_3_SCOPE.shop,order_sns:['invalid#!'],more:false}),
    async ()=>({ok:true,shop_id:F12_3_SCOPE.shop,
      order_sns:Array(11).fill('26111200000001'),more:false}),
  ]) {
    const result=await createAdaoResumableDiscovery({now:clock,readOrders:reader})();
    assert.equal(result.ok,false);
    assert.equal(result.checkpoint,null);
    assert.equal(result.page_orders.length,0);
  }
});

test('F12.3: read-only slice rejects oversized configuration; never invokes writer', async () => {
  let calls=0;
  const r=await createAdaoResumableDiscovery({now:clock,readOrders:async()=>{calls++;
    return {ok:true,shop_id:F12_3_SCOPE.shop,order_sns:[],more:false};
  }})(null,{maxPagesPerSlice:3});
  assert.equal(r.code,'invalid_slice_size');
  assert.equal(calls,0);
});
