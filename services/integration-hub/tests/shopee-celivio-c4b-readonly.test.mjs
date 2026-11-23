import test from 'node:test';
import assert from 'node:assert/strict';
import { createCelivioC4BReadOnly, CELIVIO_C4B_ACCOUNT_ID, CELIVIO_C4B_SHOP_ID } from '../src/shopee-celivio-c4b-readonly.mjs';
import { handleRequest } from '../src/app.mjs';

const NOW = Date.parse('2026-11-23T20:00:00Z');
const connection = (overrides = {}) => ({
  ok: true,
  payload: {
    channel_account_id: CELIVIO_C4B_ACCOUNT_ID,
    shop_id: CELIVIO_C4B_SHOP_ID, partner_id: 2047685,
    environment: 'live',
    access_token_expires_at: new Date(NOW + 3600000).toISOString(),
    access_token_ciphertext: 'opaque-encrypted', ...overrides,
  },
});
const env = (name) => ({
  SHOPEE_LIVE_PARTNER_KEY: 'mock-secret',
  SHOPEE_LIVE_TOKEN_ENCRYPTION_KEY: 'mock-key',
})[name];

test('C4B rejects expired token without calling Shopee or refresh', async () => {
  let reads = 0;
  const run = createCelivioC4BReadOnly({
    now: () => NOW,
    getEnv: env,
    readConnection: async () => connection({ access_token_expires_at: new Date(NOW - 1).toISOString() }),
    decryptToken: async () => { throw Error('must not decrypt'); },
    listOrders: async () => { reads++; throw Error('must not call'); },
  });
  assert.equal((await run()).code, 'access_token_expired_no_refresh');
  assert.equal(reads, 0);
});

test('C4B rejects cross-account identity before Shopee access', async () => {
  const run = createCelivioC4BReadOnly({
    now: () => NOW, getEnv: env,
    readConnection: async () => connection({ shop_id: 1156446003 }),
    decryptToken: async () => { throw Error('must not decrypt'); },
  });
  assert.equal((await run()).code, 'identity_mismatch');
});

test('C4B performs one list and one detail GET; emits only Item/Model and quantity', async () => {
  const calls = [];
  const run = createCelivioC4BReadOnly({
    now: () => NOW, getEnv: env,
    readConnection: async ({channel_account_id}) => {
      assert.equal(channel_account_id, CELIVIO_C4B_ACCOUNT_ID);
      return connection();
    },
    decryptToken: async (ciphertext) => {
      assert.equal(ciphertext, 'opaque-encrypted');
      return 'access-secret';
    },
    listOrders: async (args) => {
      calls.push(['list', args]);
      return {response: {ok: true}, payload: {response: {
        order_list: [{order_sn: '261123ABCDEFGH', buyer_username: 'PRIVATE'}],
        more: false,
      }}};
    },
    detailOrders: async (args) => {
      calls.push(['detail',args]);
      return {response:{ok:true},payload:{response:{order_list:[{
        order_sn:'261123ABCDEFGH', order_status:'READY_TO_SHIP',
        recipient_address:{name:'SECRET',phone:'999999'},
        item_list:[{item_id:1111,model_id:2222,model_quantity_purchased:3,
          item_name:'test product', model_sku:'private'}],
      }]}}};
    },
  });
  const result=await run();
  assert.equal(result.ok,true);
  assert.equal(result.written,0);
  assert.equal(result.raw_written,0);
  assert.deepEqual(result.order.items,[{item_id:'1111',model_id:'2222',quantity:3}]);
  assert.equal(JSON.stringify(result).includes('SECRET'),false);
  assert.equal(JSON.stringify(result).includes('PRIVATE'),false);
  assert.equal(calls.length,2);
  assert.equal(calls[0][1].shopId,CELIVIO_C4B_SHOP_ID);
  assert.equal(calls[0][1].pageSize,5);
  assert.deepEqual(calls[1][1].orderSnList,['261123ABCDEFGH']);
});

test('C4B returns no-order evidence without detail request', async () => {
  const run=createCelivioC4BReadOnly({
    now:()=>NOW,getEnv:env,readConnection:async()=>connection(),
    decryptToken:async()=> 'access-secret',
    listOrders:async()=>({response:{ok:true},payload:{response:{order_list:[],more:false}}}),
    detailOrders:async()=>{throw Error('must not request details');},
  });
  const r=await run();
  assert.equal(r.found,false);
  assert.equal(r.written,0);
});

test('C4B route is default OFF and rejects bodies/queries', async () => {
  const base={method:'POST',path:'/internal/shopee/celivio/c4b/read-only',headers:{}};
  const opts={handleShopeeLive:async()=>null,readCelivioC4B:async()=>{throw Error('disabled');},
    getEnv:()=>undefined};
  assert.equal(JSON.parse((await handleRequest(base,opts)).body).code,'c4b_not_enabled');
  assert.equal((await handleRequest({...base,query:{order:'x'}},opts)).status,400);
  assert.equal((await handleRequest({...base,body:'{}'},opts)).status,400);
  assert.equal((await handleRequest({...base,method:'GET'},opts)).status,405);
});

test('C4B route executes injected reader only with explicit opt-in flag', async () => {
  let calls=0;
  const result=await handleRequest(
    {method:'POST',path:'/internal/shopee/celivio/c4b/read-only',headers:{}},
    {handleShopeeLive:async()=>null,
      getEnv:(name)=>name==='SHOPEE_CELIVIO_C4B_READONLY_ENABLED'?'true':undefined,
      readCelivioC4B:async()=>{calls++;return {ok:true,found:false,written:0};}},
  );
  assert.equal(result.status,200);
  assert.equal(calls,1);
});
